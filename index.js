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
    const articlesCollection = client.db("nexusNewsDB").collection('articles');
    const publisherCollection = client.db("nexusNewsDB").collection('publisher');


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

  // article related API
  app.get("/approved-articles", async(req,res)=>{
    const query = {state:'approved'}
    const articles = await articlesCollection.find(query).toArray()
    res.send(articles)
  })

  app.post("/articles",async(req, res)=> {
    const article = req.body
    const result = await articlesCollection.insertOne(article)
    res.send(result)
  })

  // user related API
  app.post("/create-user", async(req, res)=> {
    const user = req.body;
    const query = {userEmail:user?.userEmail}
    const isExist = await usersCollection.findOne(query)
    if(isExist){
      return res.send({message:"user already Exist"})
    }
    const result = await usersCollection.insertOne(user)
    res.send(result)
  })

  // publisher related API
  app.get("/publisher",async(req,res)=> {
    const publisher = await publisherCollection.find().toArray()
    res.send(publisher)
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
