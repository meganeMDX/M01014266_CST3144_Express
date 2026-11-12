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
        const passwordMatch = await bcrypt.compare(password, profile.hashedPassword);
        if (!passwordMatch){
            return null;
        }
        // remove password from profile returned
        const {hashedPassword, ...profileReturned} = profile;

        return profileReturned;
    }

    // create account
    async register(userDetails){
        const {fullName, email, password} = userDetails;
        try{
            const hashedPassowrd = await this.hashPassword(password)

            const newUser = {
                "name": fullName,
                "email": email,
                "hashedPassword": hashedPassowrd,
                "createdOn": new Date(),
                "savedLessonIDs" : []
            }

            // add new user to collection
            const result = await this.usersCollection.insertOne(newUser);
            
            return {
                success: true,
                user: {
                    _id: result.insertedId, 
                    ...newUser
                }
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
        const {name, phoneNumber, lessons} = checkoutDetails;
        console.log("Lessons received:", lessons);
        // validate order details
        if (!name.trim() || !phoneNumber.trim() || !Array.isArray(lessons) || lessons.length === 0){
            return {success: false, message: "Invalid order details"};
        }

        // validate quantities
        for (const item of lessons){
            if (!Number.isInteger(item.space) || item.space <= 0){
                return {success: false, message: "Invalid lesson quantities"};
            }
        }

        // retrieve lessons
        const lessonIDs = lessons.map(lesson => new ObjectId(lesson.lessonId));
        const lessonDetails = await this.lessonsCollection.find({'_id': {'$in': lessonIDs}}).toArray();

        // check if incorrect IDs were passed
        if (lessonDetails.length !== lessons.length){
            return {success: false, message: "One or more lessons could not be found."};
        }

        // calculate order total price
        let totalPrice = 0;

        for (const item of lessons){

            const lesson = lessonDetails.find(l => l._id.toString() === item.lessonId);
            
            console.log("Lesson ID:", item.lessonId);
            console.log("Lesson details:", lessonDetails);
            // check availability
            if (lesson.space < item.space){
                return {success: false, message: `Not enough spaces available for ${lesson.topic}`};
            };
            totalPrice += lesson.price * item.space;
        }

        // save to database
        const orderDetails = {
            userId,
            name,
            phoneNumber,
            lessons,
            totalPrice,
            orderDate: new Date()
        };
        const results = await this.ordersCollection.insertOne(orderDetails);
        return {
            success: true, 
            message:"Order has been submitted successfully!",
            recordedOrder: {_id: results.insertedId, ...orderDetails}
        };
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
        const query = { userId: new ObjectId(userId)};
        return await this.ratingsCollection.find(query).toArray();
    }

    // rate a lesson
    async rateLesson(userId, lessonId, rating){
        const query = { "userId": new ObjectId(userId), "lessonId": new ObjectId(lessonId)};
        const session = this.client.startSession();

        try{
            session.startTransaction();

            // check if there is an existing rating
            const existingRating = await this.ratingsCollection.findOne(query, {session});

            let ratingResult;
            let lessonUpdate;

            if (existingRating){
                const ratingDiff = rating - existingRating.rating;

                // check if rating changed
                if (ratingDiff === 0){
                    await session.commitTransaction();
                    return {success: true, message: "New rating is the same as previous rating.", ratingObj: existingRating};
                }
                
                // edit existing rating
                await this.ratingsCollection.updateOne(query, {$set: {rating: rating}}, {session});
                ratingResult ={...existingRating, rating};
                lessonUpdate = {$inc: {totalRating: ratingDiff}};

            }else{
                // add a new rating
                const record = {
                    ... query,
                    rating: rating,
                };

                // add new ratings if it does not exist, else update
                const result = await this.ratingsCollection.insertOne(record, {session});
                ratingResult ={_id: result.insertedId, ...record};
                lessonUpdate = {$inc: {totalRating: rating, ratingCount: 1}};
            }
            const lessonResult = await this.lessonsCollection.updateOne({_id: new ObjectId(lessonId)}, lessonUpdate, {session});
            if (lessonResult.matchedCount === 0){
                await session.abortTransaction();
                return {success: false, message: "Lesson not found."};
            }

            await session.commitTransaction();
            return {success: true, message: "Rating submitted successfully.", ratingObj: ratingResult};

        }catch(err){
            await session.abortTransaction();
            console.log(err);
            return {success: false, message: "Failed to record new rating."};

        }finally{
            await session.endSession();
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

    // search lessons
    async searchLesson(searchedText){
        const query = {
            $or: [
                {"topic": {"$regex" : searchedText, "$options": "i"}}, 
                {"location": {"$regex" : searchedText, "$options": "i"}}, 
                { $expr: 
                    {
                        $regexMatch: {
                            input: {$toString: "$price"},
                            regex : searchedText
                        }
                    }
                }, 
                { $expr: 
                    {
                        $regexMatch: {
                            input: {$toString: "$space"},
                            regex : searchedText
                        }
                    }
                }
            ]
        };
        return await this.lessonsCollection.find(query).toArray();
    }

    // get enrollment for a lesson
    async getEnrolment(lessonId){
        const result = await this.ordersCollection.aggregate([
            {$unwind: "$lessons"},
            {
                $match: {"lessons.lessonId": lessonId}
            },
            {
                $group:{
                    _id: null,
                    "enrolmentNumber":{$sum: "$lessons.space"}
                }
            }
        ]).toArray();
        return result.length > 0 ? result[0].enrolmentNumber : 0;
    }
}

let dbManager = new dbHandler();
module.exports= {dbManager};