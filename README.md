# CST3144 Coursework Back-End

## Overview
This repository contains the back-end implementation of a fictitious web app which allows students and parents to buy after-school classes and activities stored in MongoDB.

## Libraries Used
- **Express**: Handles HTTP requests and defines API routes.
- **Express-session**: Manages user sessions and authentication state.
- **MongoDB**: To connect, store and retrieve data from MongoDB Atlas.
- **morgan**: Logs requests to the server.
- **cors**: Enables cross-origin requests between front-end and back-end.
- **dotenv**: To load environment variables from a .env file.
- **bcrypt**: For password hashing.
- **nodemon**: Automatically restarts server when changes are made during development.

## Installation
1. Clone the repository by running the following command in the terminal:
```bash
git clone https://github.com/meganeMDX/M01014266_CST3144_Express.git
```

2. Navigate to the repository's root directory and install the dependencies by running the following command in the terminal:
```bash
npm install
```

3. Create a `config.env` file in the root directory and configure the following environment variables:
- MONGODB_PREFIX 
- MONGODB_PASSWORD
- MONGODB_USERNAME
- MONGODB_URL
- DB_NAME
- COOKIE_SECRET

## Server Hosting
The back-end API is hosted on render.com at: 

https://m01014266-backend.onrender.com

## Front-end
The front-end source code is available in the following repository:

https://github.com/meganeMDX/M01014266_CST3144_Vue

The front-end application is hosted on GitHub Pages at: 

https://meganemdx.github.io/M01014266_CST3144_Vue/


## References

Dilshad, F. (2025) *Fixing HTTPS Sessions Behind Nginx: app.set('trust proxy', 1) — A One‑Line Production Fix (with PM2)*. Available at: https://medium.com/@faisal.decodes/fixing-https-sessions-behind-nginx-app-set-trust-3d01b839148d (Accessed: 15 November 2026).

FreeCodeCamp (2024) *How to Hash Passwords with bcrypt in Node.js*. Available at: https://www.freecodecamp.org/news/how-to-hash-passwords-with-bcrypt-in-nodejs/ (Accessed: 9 November 2026).

Gupta, S. (2016) *Express Session Management*. Available at: https://medium.com/@shubham3480/express-session-management-8e2da80cd1d4 (Accessed: 10 November 2026).

jfriend00 (2016) *nodeJs/Express dealing with missing static files*. Available at: https://stackoverflow.com/a/38709911 (Accessed: 9 November 2026).

MongoDB (n.d.) *$regexMatch (expression operator)*. Available at: https://www.mongodb.com/docs/manual/reference/operator/aggregation/regexmatch/ (Accessed: 8 November 2026).

MongoDB (n.d.) *$expr (query predicate operator)*. Available at: https://www.mongodb.com/docs/manual/reference/operator/query/expr/ (Accessed: 8 November 2026).

MongoDB (n.d.) *$toString (expression operator)*. Available at: https://www.mongodb.com/docs/manual/reference/operator/aggregation/tostring/ (Accessed: 8 November 2026).

MongoDB (n.d.) *Unique Indexes and Duplicate Values*. Available at: https://www.mongodb.com/docs/manual/core/index-unique/ (Accessed: 8 November 2026).