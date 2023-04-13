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
      
        const participantSchema = Joi.object({
          name: Joi.string().required().exist({
            db: db,
            collection: "participants",
            fieldName: "name"
          })
        });
      
        const validation = participantSchema.validate(req.body);
      
        if (validation.error) {
          // Retorna 422 caso o nome não seja uma string ou seja vazio
          return res.status(422).send(validation.error.details[0].message);
        }
      
        try {
          // Verifica se o nome já existe no banco de dados
          const participant = await db
            .collection("participants")
            .findOne({ name: name });
      
          if (participant) {
            // Retorna 409 caso o nome já exista no banco de dados
            return res.sendStatus(409);
          }
      
          // Cadastra o participante no banco de dados
          const user = {
            name: name,
            lastStatus: Date.now()
          };
      
          const result = await db.collection("participants").insertOne(user);
          const time = new Date(user.lastStatus).toLocaleTimeString("pt-BR");
          const message = {
            from: user.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time
          };
          await db.collection("messages").insertOne(message);
          res.sendStatus(201);
        } catch (err) {
          res.status(500).send(err.message);
        }
      });
app.listen(5000)