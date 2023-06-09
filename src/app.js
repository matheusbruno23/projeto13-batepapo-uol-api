import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from 'dotenv';
import Joi from "joi";
import dayjs from "dayjs";


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
    //Validação de usuário pelo Joi
    const participantSchema = Joi.object({
        name: Joi.string().required().exist({
            db: db,
            collection: "participants",
            fieldName: "name"
        })
    });
    //valida o nome
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
        
        // Formata o horário para a mensagem de entrada
        const time = new Date(user.lastStatus).toLocaleTimeString("pt-BR");
        const message = {
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time
        };

        //Envia mensagem automática no chat
        await db.collection("messages").insertOne(message);
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.get("/participants", async (req, res) => {
    try {
        //verifica quantidade de usuários cadastrados
        const size = await db.collection("participants").countDocuments({});
        //retorna um array vazio caso nenhum usuário esteja cadastrado
        if (size === 0) {
            return res.send([]);
        }
        const users = await db.collection("participants").find().toArray();
        res.send(users);
    } catch (err) {
        res.send(err.message);
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const from = req.headers.user
    if (!from) {
        return res.sendStatus(422)
    }

    //Validação da mensagem com Joi

    const messageSchema = Joi.object({
        to: Joi.string().required().not().empty(),
        text: Joi.string().required().not().empty(),
        type: Joi.string().required().valid('message', 'private_message')
    })

    const validation = messageSchema.validate({ to, text, type });

    if (validation.error) {
        return res.sendStatus(422)
    }

    const participant = await db.collection("participants").findOne({ name: from })
    if (!participant) {
        return res.sendStatus(422)
    }

    const message = {
        from,
        to,
        text,
        type,
        time: dayjs().format("HH:mm:ss"),
    }

    await db.collection("messages").insertOne(message)
    res.sendStatus(201)
})

app.get("/messages", async (req, res) => {
    const user = req.headers.user

    const limit = parseInt(req.query.limit)
    if (isNaN(limit) || limit <= 0) {
        return res.sendStatus(422)
    }
    // Consulta se o usuário pode ver a mensagem
    const query = {
        $or: [
            { to: "Todos" },
            { to: user },
            { from: user, type: "private_message" },
            { type: "message" },
        ],
    }

    const options = {}
    if (limit) {
        options.limit = limit
    }

    const messages = await db.collection("messages").find(query, options).toArray()
    res.status(200).send(messages)
})

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    if (!user) {
        return res.sendStatus(404);
    }

    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) {
        return res.sendStatus(404)
    }

    let newDate = Date.now()
    participant.lastStatus = newDate;
    await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: participant.lastStatus } });
    return res.sendStatus(200);
});


//removendo usuários afk

setInterval(async () => {
    const now = Date.now()
    const tempoLimite = now - 10000
    const messages = []
    //pega os usuários afks
    const usersafk = await db.collection("participants").find({ lastStatus: { $lt: tempoLimite } }).toArray()

    if (usersafk.length > 0) {
        usersafk.forEach(async (user) => {
            const message = {
                from: user.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss")
            }
            messages.push(message)

        });
    }
    if (messages.length > 0) {
        await db.collection("messages").insertMany(messages);
    }

    await db.collection("participants").deleteMany({ lastStatus: { $lt: tempoLimite } })

}, 15000)

app.listen(5000)