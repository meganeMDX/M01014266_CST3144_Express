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
}

let dbManager = new dbHandler();
module.exports= {dbManager};