require("dotenv").config({ path: "./config.env" });
const { MongoClient, ObjectId } = require("mongodb");

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
}

let dbManager = new dbHandler();
module.exports= {dbManager};