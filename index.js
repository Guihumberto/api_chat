import express from "express";
import { Client as ElasticClient } from "@elastic/elasticsearch";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";

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

const indexName = "document_embeddings";

const model = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-small",
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
        { "role": "user", "content": `Você precisa responder à pergunta com base no 
            contexto abaixo:\n\nCONTEXTO:\n${context}\n\nPERGUNTA: ${question}\n\nResponda com base no 
            contexto e seja claro e preciso, fazendo referencia ao texto quando necessário.` }
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

//gravar documento

const chunkSize = 500; // Tamanho do chunk
const overlapSize = Math.floor(chunkSize * 0.2); // Sobreposição de 20%

const splitter = new CharacterTextSplitter({
    separator: ".",  // Define o separador como ponto final
    chunkSize: chunkSize,
    chunkOverlap: overlapSize,
    lengthFunction: (str) => str.length, // Função para medir o tamanho do chunk
    isSeparatorRegex: false, // Define que o separador não é uma regex
});

async function getDocument(id){
    try {
        const response = await es.get({
            index: 'documents',
            id
        });
        return response._source;
    } catch (error) {
        console.log('erro ao buscar documento', error);
    }
}

async function indexChunks(allSplits, docId, title) {
    console.log(docId, title);
    for (let i = 0; i < allSplits.length; i++) {
      const chunk = allSplits[i];
      const text = chunk.pageContent;
      
      console.log(`Chunk ${i + 1}: ${text}`);
  
      const embedding = await model.embedQuery(text);
  
      const doc = {
        text,
        title,
        id: docId,
        embedding, 
      };
  
      await es.index({
        index: indexName,
        body: doc,
      });
    }
  
    console.log(`${allSplits.length} chunks foram indexados com sucesso no Elasticsearch!`);
}

async function saveEmbbeddingsDocument(id){
    const resp = await getDocument(id)

    const full_text = resp.pages.map(page => page.text_page).join(' ')
    
    const metadatas = [{
        id,
        'nome do arquivo': resp.title
    }]

    const allSplits = await splitter.createDocuments([full_text], metadatas);

    console.log(allSplits.map(chunk => ({
        text: chunk.pageContent,
        metadata: chunk.metadata
    })));

    indexChunks(allSplits, id, resp.title);
}

app.post('/save-embeddings', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "ID não fornecido." });
        await saveEmbbeddingsDocument(id);
        res.send('Embedding salvo com sucesso!');
    } catch (error) {
        console.error("Erro:", error);
        res.status(500).json({ error: "Erro interno ao processar o documento." });
    }
 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));