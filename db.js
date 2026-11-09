require("dotenv").config({ path: "./config.env" });
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require('bcrypt');
const saltRounds = 10; 

class dbHandler{
    constructor(){
        this.connectionURI = process.env.MONGODB_PREFIX + process.env.MONGODB_USERNAME + ":" + process.env.MONGODB_PASSWORD + process.env.MONGODB_URL;
        this.client = new MongoClient(this.connectionURI);
        this.db = this.client.db(process.env.DB_NAME);

        this.lessonsCollection = this.db.collection("lessons");
        this.teachersCollection = this.db.collection("teachers");
        this.usersCollection = this.db.collection("users");
        this.ordersCollection = this.db.collection("orders");
        this.ratingsCollection = this.db.collection("ratings");
    }

    async connectToMongoDB() {
        try {
            await this.client.connect();

            // prevent duplicate emails for users
            await this.usersCollection.createIndex({ "email": 1 }, { unique: true } )

            // prevent duplicate ratings per user per lesson
            await this.ratingsCollection.createIndex({ "userId": 1, "lessonId": 1 }, { unique: true } )

            console.log("You successfully connected to MongoDB!");
        } catch (err) {
            console.log("MongoDB connection failed: ", err);
            throw err;
        }
    }

    // get list of lessons and activities
    async getLessons(){
        return await this.lessonsCollection.find({}).toArray();
    }

    // get list of teachers
    async getTeachers(){
        return await this.teachersCollection.find({}).toArray();
    }

    async login(credentials){
        const {email, password} = credentials;
        const profile = await this.usersCollection.findOne({"email" : `${email}`})

        // check if there is a corresponding profile
        if (!profile){
            return null;
        }

        // check if password entered is correct
        const passwordMatch = await bcrypt.compare(password, profile.hashed_password);
        if (!passwordMatch){
            return null;
        }
        // remove password from profile returned
        const profileReturned = {hashed_password, ...profile};

        return profileReturned;
    }

    // create account
    async register(userDetails){
        const {full_name, new_email, new_password} = userDetails;
        try{
            const hashedPassowrd = await this.hashPassword(new_password)

            const newUser = {
                "name": full_name,
                "email": new_email,
                "hashed_password": hashedPassowrd,
                "created_on": new Date(),
                "savedLessonIDs" : []
            }

            // add new user to collection
            const result = await this.usersCollection.insertOne(newUser);

            return {
                success: true,
                userId: result.insertedId
            };
            
        }catch(error){
            // check if email is already in use
            if (error.code === 11000){
                return {
                    success: false, 
                    message: "This email is already in use."
                };
            }
            throw error;
        }
    }

    // hash password
    async hashPassword(password){
        const salt = await bcrypt.genSalt(saltRounds);
        return await bcrypt.hash(password, salt);
    }

    // record new order
    async addOrder(userId, checkoutDetails){
        const orderDetails = {
            userId,
            ...checkoutDetails
        };
        const results = await this.ordersCollection.insertOne(orderDetails);
        return results.insertedId;
    }

    // get user order history
    async getOrderHistory(userId){
        const query = { userId: new ObjectId(userId)};
        return await this.ordersCollection.find(query).toArray();
    }

    // update lesson details
    async updateLesson(lessonId, update, session={}){

        // check attribute and value before updating
        const stringAttr = ["topic", "category", "itemType", "location", "description", "imagePath", "scheduledDay"];
        const floatAttr = ["price"];
        const intAttr = ["space", "totalRating", "ratingCount"];
        const dateAttr = ["scheduledStartTime", "scheduledEndTime"];
        const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

        for (const [attribute, value] of Object.entries(update)){
            if (attribute === "_id"){
                return {success: false, message: "Cannot modify the lesson id."};
            }
                
            else if (stringAttr.includes(attribute)){
                if (typeof(value) !== "string"){
                    return {success: false, message: `${attribute} must be a string.`};
                }
                if (attribute === "scheduledDay" && !days.includes(value.toLowerCase())){
                    return {success: false, message: "scheduledDay must be a valid day of the week."};
                }
            }

            else if (floatAttr.includes(attribute)){
                if (typeof(value) !== "number" || value < 0){
                    return {success: false, message: `${attribute} must be a number greater than or equal to 0.`};
                }                
            }

            else if (intAttr.includes(attribute)){
                if (!Number.isInteger(value) || value < 0){
                    return {success: false, message: `${attribute} must be an integer greater or equal to 0.`};
                }                
            }

            else if(dateAttr.includes(attribute)){
                if (typeof(value) !== "string" || !timeRegex.test(value)){
                    return {success: false, message: `${attribute} must be a time in HH:MM (24-hour) string format.`};
                }
            }
            else{
                // not an existing attribute
                return {success: false, message: `${attribute} is an invalid attribute.`};
            }
        }

        const query = { _id: new ObjectId(lessonId)};
        const results = await this.lessonsCollection.updateOne(query, {$set: update}, session=session);
        if (results.matchedCount === 1){
            return {success: true, message: "Lesson updated successfully!"}
        }
        return {success: false, message: "Lesson not found."};
    }

    // fetch all ratings made by a user
    async getAllUserRatings(userId){
        const query = {"userId": userId};
        return await this.ratingsCollection.findOne(query);
    }

    // rate a lesson
    async rateLesson(userId, lessonId, rating){
        const query = { "userId": userId, "lessonId": lessonId};
        const session = this.client.startSession();

        let ratingResult;
        try{
            session.startTransaction();

            // check if there is an existing rating
            const existingRating =await this.ratingsCollection.findOne(query, {session});

            let lessonUpdate;

            if (existingRating){
                const ratingDiff = rating - existingRating.rating;

                // check if rating changed
                if (ratingDiff === 0){
                    return {success: true, message: "New rating is the same as previous rating."};
                }
                
                // edit rating
                await this.ratingsCollection.updateOne(query, {$set: {rating: rating}}, {session});
                lessonUpdate = {$inc: {ratingTotal: ratingDiff}};

            }else{
                // new rating
                const record = {
                    userId: userId,
                    lessonId: lessonId,
                    rating: rating,
                };

                // add new ratings if it does not exist, else update
                await this.ratingsCollection.insertOne(record, {session});
                lessonUpdate = {$inc: {ratingTotal: rating, ratingCount: 1}};
            }
            const lessonResult = await this.updateLesson(query, lessonUpdate, {session});
            if (!lessonResult.success){
                return {success: false, message: lessonResult.message}
            }

            await session.commitTransaction();
            return {success: true, message: "New rating recorded successfully."};

        }catch(error){
            await session.abortTransaction();
            return {success: false, message: "Failed to record new rating."};

        }finally{
            session.endSession();
        }
    }

    // save or unsave lesson for user
    async saveUnsaveLesson(userId, lessonId, saving=true){
        const query = {_id: new ObjectId(userId)};
        let update;
        if (saving){
            update = {$addToSet: {savedLessonIDs : lessonId}};
        }else{
            update = {$pull: {savedLessonIDs : lessonId}};
        }
        const results = await this.usersCollection.updateOne(query, update);
        return results.matchedCount === 1;
    }
}

let dbManager = new dbHandler();
module.exports= {dbManager};