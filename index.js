const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(
  cors({
    origin: ["http://localhost:5173"],
  })
);
app.use(express.json());




  






const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.3azmgms.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const usersCollection = client.db("nexusNewsDB").collection('users');


    const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
      return res
        .status(401)
        .send({ message: "Login First: unAuthorized access" });
    }
    const token = req.headers.authorization;
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .send({ message: "unAuthorized access" });
      }
      console.log("decoded",decoded);
      req.decoded = decoded
      next();
    });
  
  };
  
  app.post("/jwt", async (req, res) => {
    const email = req.body;
    const token =  jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1hr",
    });
    res.send({ token });
  });

  // user related API
  app.post("/create-user", async(req, res)=> {
    const user = req.body;
    const query = {email:user?.email}
    const isExist = await usersCollection.findOne(query)
    if(isExist){
      return res.send({message:"user already Exist"})
    }
    const result = await usersCollection.insertOne(user)
    res.send(result)
  })
  


  
  // payment
  app.post("/payment",async(req, res)=>{
    const {price} = req.body
    const amount = parseInt(price * 100)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      "payment_method_types": [ "card"]
    })
    res.send({
      clientSecret:paymentIntent.client_secret
    })
  } )
   

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    ;
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});
