const { dbManager } = require("./db.js");
const express = require('express');
const app = express();
const PORT = 3000;
const path = require('path');
const expressSession = require('express-session');
const cors = require('cors');
app.use(cors());
app.use(express.json());

// set up database connection
dbManager.connectToMongoDB();

//Load and serve static images
app.use('/images', express.static(path.join(__dirname, 'images'), {fallthrough: false}));

// if file does not exist
app.use('/images', (err, req, res, next) => {
    console.log(err);
    if (err.status === 404){
        return res.status(404).send("Image not found.");
    }
    return res.status(500).send("Failed to load image.");
});

// to use express session
app.use(
    expressSession({
        secret: process.env.COOKIE_SECRET,
        cookie: {maxAge: 1000 * 60 * 60 * 24},
        resave: false,
        saveUninitialized: false
    })
);

// log requests
var morgan = require('morgan')
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// log user in
app.post("/login", async function(req, res)
{
    try{
        const userDetails = req.body;
        if(!userDetails || Object.keys(userDetails).length === 0){
            return res.status(400).send("Missing required fields.");
        }
        const profile = await dbManager.login(userDetails);
        if (profile){
            req.session.userId= profile._id;
            return res.status(201).json({login: true, user: profile });
        }else{
            return res.status(400).json({login: false, message: "Email or password is incorrect. Please try again." });
        }
        
    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Log in failed."})        
    }
});

// register user
app.post("/register", async function(req, res)
{
    try{
        const userDetails = req.body;
        if(!userDetails || Object.keys(userDetails).length === 0){
            return res.status(400).send("Missing required fields.");
        }
        const result = await dbManager.register(userDetails);
        if (result.success){
            req.session.userId = result.userId;
            return res.status(201).json({login: true, userId: userId });
        }else{
            return res.status(400).json({login: false, message: result.message});
        }
        
    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Register failed."})        
    }
});

// logout
app.delete("/login", async function(req, res)
{
    try{
        if (!req.session.userId){
            return res.status(401).json({login:false, message: "You must be logged in to logout."});
        }

        req.session.destroy();
        res.status(200).json({login:false, message:"Logged out Successfully."})
        
    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Log out failed."})        
    }
});

// returns all lessons and activities
app.get("/lessons", async function(req, res)
{
    try{
        const lessons = await dbManager.getLessons();
        res.status(200).json(lessons);

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to retrieve lessons and activities." })
    }
});

// returns all teachers
app.get("/teachers", async function(req, res)
{
    try{
        const teachers = await dbManager.getTeachers();
        res.status(200).json(teachers);

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to retrieve teachers information."})
    }
});

// returns number of slots purchased for a lesson
app.get("/enrolment/:lessonid", async function(req, res)
{
    const lessonID = req.params.lessonid;
    try{
        const enrolmentNum = await dbManager.getEnrolment(lessonID);
        res.status(200).json(enrolmentNum);

    }catch(err){
        console.log(err);
        res.status(500).json({ message: `Failed to retrieve the enrolment number for lesson ${lessonID}.`})
    }
});

// saves a new order
app.post("/order", async function(req, res)
{
    try{
        if (!req.session.userId){
            return res.status(401).json({login:false, message: "You must be logged in to place an order."});
        }

        const orderDetails = req.body;
        if(!orderDetails || Object.keys(orderDetails).length === 0){
            return res.status(400).send("Missing required fields.");
        }
        const orderId = await dbManager.addOrder(req.session.userId, orderDetails);
        res.status(201).send({message:"Order has been submitted successfully!", orderId});

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to place order." })
    }
});

// update a lesson
app.put("/lesson/:lessonid", async function(req, res)
{
    const lessonID = req.params.lessonid;
    try{
        // query is passed in the body
        const update = req.body;
        if(!update || Object.keys(update).length === 0){
            return res.status(400).send("Missing required fields.");
        }

        const result = await dbManager.updateLesson(lessonID, update);
        if (result.success){
            return res.status(200).json(result);
        }
        return res.status(404).json(result);
 
    }catch(err){
        console.log(err);
        res.status(500).json({ message: `Failed to update lesson ${lessonID}.`})

    }
});

// returns search results
app.get("/lessons/search", async function(req, res)
{
    try{
        if (!req.query.q){
            return res.status(401).send("Missing query parameter");
        }

        const searchedText = req.query.q;
        const results = await dbManager.searchLesson(searchedText);
        res.status(200).json(results);

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to retrieve search results"})
    }
});

// return order history of a user
app.get("/history", async function(req, res)
{
    try{
        if (!req.session.userId){
            return res.status(401).json({login:false, message: "You must be logged in to view your order history."});
        }
        const orderHistory = await dbManager.getOrderHistory(req.session.userId);
        res.status(200).json(orderHistory);

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to retrieve order history of user."})

    } 
});

// get ratings made by a user
app.get("ratings", async function(req, res)
{
    try{
        if (!req.session.userId){
            return res.status(401).json({login:false, message: "You must be logged in to retrieve all the ratings you made."});
        }

        const ratings = await dbManager.getAllUserRatings(req.session.userId);
        res.status(200).json(ratings);

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to retrieve ratings made by user."})
    } 
});

// rate lesson
app.put("/ratings", async function(req, res)
{
    try{
        if (!req.session.userId){
            return res.status(401).json({login:false, message: "You must be logged in to rate a lesson."});
        }

        const {lessonId, rating} = req.body;
        if (!lessonId || !rating){
            res.status(400).json({message: "Missing fields: lessonId and rating are required."});
            return;
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5){
            res.status(400).json({message: "Rating must be an integer between 1 and 5."});
            return;
        }

        const result = await dbManager.rateLesson(req.session.userId, lessonId, rating);
        if (result.success){
            res.status(200).json(result);
        }else{
            res.status(404).json(result);
        }

    }catch(err){
        console.log(err);
        res.status(500).json({ message: "Failed to rate lesson."})
    } 
});

app.use((err, req, res) => {
    res.status(404).send("Page not found !")
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});