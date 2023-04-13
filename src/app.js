import express from "express"
import cors from "cors"
import {MongoClient, ObjectId} from "mongodb"
import dotenv from 'dotenv';
import Joi from "joi";


const app = express()

app.use(cors())
app.use(express.json())

dotenv.config();

let db
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message)) 


    app.post("/participants", async (req, res) => {
        const { name } = req.body;
      
        if (typeof name !== "string" || name === "") {
          return res.status(422).send("Invalid name");
        }
      
        const user = {
          name: name,
          lastStatus: Date.now(),
        };
      
        try {
          const result = await db.collection("participants").insertOne(user);
          const time = new Date(user.lastStatus).toLocaleTimeString("pt-BR");
          const message = {
            from: user.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time,
          };
          await db.collection("messages").insertOne(message);
          res.sendStatus(201);
        } catch (err) {
          res.status(500).send(err.message);
        }
      });

app.listen(5000)