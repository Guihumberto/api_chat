import express from "express";
import { Client as ElasticClient } from "@elastic/elasticsearch";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const es = new ElasticClient({
    cloud: { id: process.env.ELASTIC_CLOUD_ID },
    auth: {
        username: process.env.ELASTIC_USER,
        password: process.env.ELASTIC_PASSWORD
    }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/", (req, res) => {
    res.send("Uhu, O servidor está rodando! 🚀\nComo posso te ajudar com a legislação hoje?");
});

async function generateEmbedding(text) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text
    });
    return response.data[0].embedding;
}

async function searchRelevantChunks(question, idCollection, top_k = 5) {
    const query_embedding = await generateEmbedding(question);

    const search_body = {
        "size": top_k,
        "query": {
            "script_score": {
                "query": { 
                    "match": {
                        "id": idCollection
                    }
                },
                "script": {
                    "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    "params": { "query_vector": query_embedding }
                }
            }
        }
    };

    const response = await es.search({
        index: process.env.ELASTIC_INDEX,
        body: search_body
    });

    return response.hits.hits.map(hit => hit._source.text);
}

async function generateAnswer(question, idCollection) {
    const retrieved_chunks = await searchRelevantChunks(question, idCollection);
    const context = retrieved_chunks.join("\n");

    const messages = [
        { "role": "system", "content": "Você é um assistente jurídico." },
        { "role": "user", "content": `Você precisa responder à pergunta com base no contexto abaixo:\n\nCONTEXTO:\n${context}\n\nPERGUNTA: ${question}\n\nResponda com base no contexto e seja claro e preciso.` }
    ];

    const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
    });

    return response.choices[0].message.content;
}

app.post("/ask", async (req, res) => {
    try {
        const { question, idCollection } = req.body;

        if (!question) return res.status(400).json({ error: "Pergunta não fornecida." });
        if (!idCollection) return res.status(400).json({ error: "idCollection não fornecido." });

        const answer = await generateAnswer(question, idCollection);
        res.json({ answer });
    } catch (error) {
        console.error("Erro:", error);
        res.status(500).json({ error: "Erro interno ao processar a pergunta." });
    }
});

app.post("/embedding", async (req, res) => {
    try {
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ error: "O campo 'input' é obrigatório." });
        }

        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input
        });

        res.json({ embedding: response.data[0].embedding });
    } catch (error) {
        console.error("Erro ao gerar embedding:", error);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

app.post("/chat", async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "O campo 'messages' deve ser um array." });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages
        });

        res.json({ response: response.choices[0].message.content });
    } catch (error) {
        console.error("Erro ao gerar resposta:", error);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));