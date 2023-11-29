const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(
  cors({
    origin: ["http://localhost:5173", "https://nexusnewsbd.netlify.app"],
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
  },
});

async function run() {
  try {
    const usersCollection = client.db("nexusNewsDB").collection("users");
    const articlesCollection = client.db("nexusNewsDB").collection("articles");
    const publisherCollection = client
      .db("nexusNewsDB")
      .collection("publisher");

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res
          .status(401)
          .send({ message: "Login First: unAuthorized access" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unAuthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // article related API
    app.get("/all-articles", verifyToken, async (req, res) => {
      const result = await articlesCollection.find().toArray();
      res.send(result);
    });

    app.get("/trendingArticle", async (req, res) => {
        const query = { state:"approved" }
      const result = await articlesCollection
        .find(query)
        .sort({ viewCount: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.findOne(query);
      res.send(result);
    });
    app.patch("/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.findOne(query);
      const previousViewCount = result.viewCount;
      const newViewCount = {
        $set: {
          viewCount: previousViewCount + 1,
        },
      };
      const updateViewCount = await articlesCollection.updateOne(
        query,
        newViewCount,
        { upsert: true }
      );
      res.send(newViewCount);
    });

    app.patch("/approve-state/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateState = {
        $set: {
          state: "approved",
          declineMessage: "",
        },
      };
      const result = await articlesCollection.updateOne(query, updateState);
      res.send(result);
    });

    app.patch("/decline-state/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const { message } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateState = {
        $set: {
          state: "declined",
          declineMessage: message,
        },
      };
      const result = await articlesCollection.updateOne(query, updateState);
      res.send(result);
    });

    app.patch("/make-premium/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateState = {
        $set: {
          isPremium: true,
        },
      };
      const result = await articlesCollection.updateOne(query, updateState);
      res.send(result);
    });

    app.post("/approved-articles", async (req, res) => {
      const { searchedValue } = req.body;
      const query = {
        $and: [
          { state: "approved" },
          {
            $or: [
              { tag: { $regex: searchedValue, $options: "i" } },
              { title: { $regex: searchedValue, $options: "i" } },
            ],
          },
        ],
      };

      const articles = await articlesCollection.find(query).toArray();
      res.send(articles);
    });

    app.post("/articles",verifyToken, async (req, res) => {
      const article = req.body;
      const result = await articlesCollection.insertOne(article);
      res.send(result);
    });

    app.get("/premiumArticles",verifyToken, async (req, res) => {
      const query = { isPremium: true };
      const result = await articlesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/my-articles/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };
      const result = await articlesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/articlesCount", verifyToken, async (req, res) => {
      const allArticles = await articlesCollection.estimatedDocumentCount();
      const approvedArticles = await articlesCollection.countDocuments({
        state: "approved",
      });
      const pendingArticles = await articlesCollection.countDocuments({
        sate: "pending",
      });
      const declinedArticles = await articlesCollection.countDocuments({
        sate: "declined",
      });
      res.send({
        allArticles,
        approvedArticles,
        pendingArticles,
        declinedArticles,
      });
    });

    app.patch("/edit-article/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { title, image, publisher, tag, description } = req.body;
      const filter = {
        _id: new ObjectId(id),
      };
      const updatedDoc = {
        $set: {
          title,
          image,
          publisher,
          tag,
          description,
        },
      };
      const result = await articlesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/delete-article/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.deleteOne(query);
      res.send(result);
    });

    // user related API
    app.get("/all-users",verifyToken, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.get("/usersCount", async (req, res) => {
      const allUsers = await usersCollection.estimatedDocumentCount();
      const normalUsers = await usersCollection.countDocuments({
        isPremiumTaken: false,
      });
      const premiumUsers = await usersCollection.countDocuments({
        isPremiumTaken: true,
      });
      res.send({ allUsers, normalUsers, premiumUsers });
    });

    app.get("/user/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    app.patch("/make-user-admin/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id),
      };
      const updatedUserRole = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedUserRole);
      res.send(result);
    });

    app.post("/create-user", async (req, res) => {
      const user = req.body;
      const query = { userEmail: user?.userEmail };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "user already Exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/update-user/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const { updatedImage, updatedName } = req.body;
      const query = { userEmail: email };
      const updatedUser = {
        $set: {
          userName: updatedName,
          userImage: updatedImage,
        },
      };
      const result = await usersCollection.updateOne(query, updatedUser);
      res.send(result);
    });

    app.get("/check-admin-isPremium/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.patch("/check-premiumTakenExpiration/:email",verifyToken,async(req,res)=> {
      const loggedInUser = req.params.email;
      const query = {userEmail:loggedInUser}
      const date = new Date()
      const user = await usersCollection.findOne(query)
      if(user.isPremiumTaken && new Date(`${user.premiumTakenExpiration}`) < date){
        const updatedDoc = {
          $set:{
            isPremiumTaken:false,
            premiumTakenExpiration:null
          }
        }
        const result = await usersCollection.updateOne(user,updatedDoc)
        res.send(result)
        return
      }
      res.send(user)
    })

    // publisher related API
    app.get("/publisher", async (req, res) => {
      const publisher = await publisherCollection.find().toArray();
      res.send(publisher);
    });

    app.post("/add-publisher",verifyToken, async (req, res) => {
      const { name, image } = req.body;
      const newPublisher = { publisherName: name, publisherImage: image };
      const result = await publisherCollection.insertOne(newPublisher);
      res.send(result);
    });

    app.get("/publisher-states",verifyToken, async (req, res) => {
      const result = await publisherCollection
        .aggregate([
          {
            $lookup: {
              from: "articles",
              localField: "publisherName",
              foreignField: "publisher",
              as: "publishers",
            },
          },
          { $unwind: "$publishers" },
          {
            $group: {
              _id: "$publishers.publisher",
              quantity: { $sum: 1 },
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // payment
    app.post("/payment", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.patch("/subscription/:planNo",verifyToken, async (req, res) => {
      const { planNo } = req.params;
      const planInt = parseFloat(planNo);
      const {user} = req.body
      const date = new Date
      let expiration;
      if (planInt === 1) {
         expiration = new Date(date.getTime()+60000)
     
      } else if (planInt === 2) {
        expiration = new Date(date.getTime() + 5 * 24 * 60 * 60 * 1000)
      } else if (planInt === 3) {
        expiration = new Date(date.getTime() + 10 * 24 * 60 * 60 * 1000)
      }
      const query = {userEmail:user}
      const updatedDoc = {
        $set:{
          premiumTakenExpiration:expiration,
          isPremiumTaken:true
        }
      }
      const result = await usersCollection.updateOne(query,updatedDoc)
      res.send(result)
     
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});
