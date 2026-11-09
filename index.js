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
})

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


app.use((err, req, res) => {
    res.status(404).send("Page not found !")
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
})