import express from "express";
import { Client as ElasticClient } from "@elastic/elasticsearch";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";

const app = express();
dotenv.config();

const allowedOrigins = [
  "https://leges.estudodalei.com.br",
  "https://legislacao.estudodalei.com.br",
  "https://www.leges.estudodalei.com.br",
  "http://localhost:3000",
  "https://www.amapa.estudodalei.com.br"
];


app.use(express.json());

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (como mobile apps ou curl/postman)
    console.log("CORS origin:", origin);
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: false, // se você estiver usando cookies ou headers de autenticação
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

//importar rotas
import concusoRoutes from '../routes/concurso.js'
import forumRoutes from '../routes/forum.js'
import paymentRoutes  from '../routes/payments.js'
import webhookRoutes  from '../routes/webhooks.js'


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

// Rotas
app.use('/concursos', concusoRoutes({ openai, es }));
app.use('/forum', forumRoutes({ openai, es }));
app.use('/paymentml', paymentRoutes({ openai, es }));
app.use('/mercadopagowh', webhookRoutes({ openai, es }));


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
                query: idCollection
                    ? { match: { id: idCollection } } 
                    : { match_all: {} },              
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

async function generateAnswer(question, idCollection = null) {
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
        max_tokens: 200,
        temperature: 0.7
    });

    return response.choices[0].message.content;
}

app.post("/ask", async (req, res) => {
    try {
        const { question, idCollection } = req.body;

        if (!question) return res.status(400).json({ error: "Pergunta não fornecida." });

        if (!idCollection) {
            const answer = await generateAnswer(question);
            return res.json({ answer });
        }

        const answer = await generateAnswer(question, idCollection);
        return res.json({ answer });
    } catch (error) {
        console.error("Erro:", error);
        return res.status(500).json({ error: "Erro interno ao processar a pergunta." });
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

const chunkSize = 900; // Tamanho do chunk
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

async function getPagesCollection(ids){
    try {
        const response = await es.search({
            index: 'pages_v2',
            size: 10000,
            body: {
                query: {
                    terms: {
                        "page_to_norma.parent": ids // Lista de IDs
                    }
                }
            }
        });
        const documents = response.hits.hits.map(hit => hit._source);
        return documents;
    } catch (error) {
        console.log("error");
    }
}

async function saveEmbbeddingsCollection(ids, title, id){
    const resp = await getPagesCollection(ids)

    const full_text = resp.map(page => page.text_page).join(' ')

    const metadatas = [{
        id,
        'nome do arquivo': title
    }]

    const allSplits = await splitter.createDocuments([full_text], metadatas);

    indexChunks(allSplits, id, title);
}

app.post('/save-collection-embeddings', async (req, res) => {
    try {
        const { ids, title, id } = req.body;
        if (!ids.length) return res.status(400).json({ error: "ID não fornecido." });

        await saveEmbbeddingsCollection(ids, title, id);
        return res.send('Embedding salvo com sucesso!');
    } catch (error) {
        console.error("Erro:", error);
        res.status(500).json({ error: "Erro interno ao processar o documento." });
    }
 
});

app.post('/resumir', async (req, res) => {
    const { texto, orientacao = null } = req.body;
  
    if (!texto) {
      return res.status(400).json({ error: 'Texto é obrigatório.' });
    }
  
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4', // ou gpt-4 se tiver acesso
        messages: [
          {
            role: 'system',
            content: orientacao || 'Você é um assistente que resume textos de forma clara e objetiva.  IMPORTANTE: não use blocos de código nem /`/`/`//html na resposta. Apenas retorne o HTML diretamente como texto.',
          },
          {
            role: 'user',
            content: `
                Resuma e retorne o texto formatado em html para dar destaques relevantes no seguinte texto:\n\n${texto}
                Faça relações relevantes de como esse trecho é cobrado em questoes de concurso publico, principalmente da cespe.
                Faça relações com a jurisprudencia do STF e do STJ caso ja tenham sido objeto de prova de concursos públicos e do exame da oab.
                Resuma de forma organizada e estruturada, explicando algum termo que precise ser conceituado.
                Faça marcações no texto em negrito, italico ou sublindado, use cores para destacar.
            `,
          },
        ],
      });
  
      const resumo = completion.choices[0].message.content;
      return res.json({ resumo });
    } catch (error) {
      console.error('Erro ao chamar a API da OpenAI:', error);
      res.status(500).json({ error: 'Erro ao gerar resumo.' });
    }
});

app.post('/palavras-chave', async (req, res) => {
    const { texto } = req.body;
  
    if (!texto) {
      return res.status(400).json({ error: 'Texto é obrigatório.' });
    }
  
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente que extrai as palavras-chave importantes de textos.',
          },
          {
            role: 'user',
            content: `Extraia até 5 principais palavras-chave do seguinte texto, separadas por vírgula:\n\n${texto}`,
          },
        ],
      });
  
      const palavrasChave = completion.choices[0].message.content;
      return res.json({ palavrasChave });
    } catch (error) {
      console.error('Erro ao chamar a API da OpenAI:', error);
      res.status(500).json({ error: 'Erro ao extrair palavras-chave.' });
    }
});

async function filterArtsLawQuestoes(id_group, list_arts) {
    const search_body = {
        "size": 50,
        "query": {
            bool: {
                must: [
                    { terms: { art: list_arts } },
                    { term: { idGroup: id_group } }
                ]
            }
        }
    };

    const response = await es.search({
        index: 'law_forum',
        body: search_body
    });

    return response.hits.hits.map(hit => hit._source.textlaw);
}

async function indexQuestoesElastic(allSplits, id_law, id_art, list_arts, id_origin_law) {
    let dataAtual = new Date();
    let ano = dataAtual.getFullYear();
    for (let i = 0; i < allSplits.length; i++) {
      const questao = allSplits[i];
  
      const doc = {
        ...questao,
        id_origin_law,
        id_law,
        id_art,
        list_arts,
        tipo: 'c/e',
        date_created: Date.now(),
        created_by: 'admin',
        banca: 'GERADA POR IA',
        concurso: 'GERADA POR IA',
        ano: ano
      };
  
      await es.index({
        index: 'questoes',
        body: doc,
      });
    }
  
    console.log(`${allSplits.length} questões foram indexados com sucesso no Elasticsearch!`);
}

async function generateQuestoes(id_group, id_art, list_arts, id_origin_law) {
    const filterArt = await filterArtsLawQuestoes(id_group, list_arts);
    const context = filterArt.filter(Boolean).join("\n");

    const messages = [
        {
            role: "system",
            content: "Você é um assistente jurídico que gera questões de concurso com base em um texto."
        },
        {
            role: "user",
            content: `Gere 5 questões do tipo certo/errado no estilo CESPE/CEBRASPE com base no CONTEXTO abaixo.
            
            CONTEXTO:
            ${context}
            
            Instruções:
            - Retorne a resposta **exclusivamente** como um **array JSON válido**.
            - Cada objeto do array deve ter a seguinte estrutura:
            {
            "pergunta": "texto da pergunta",
            "resposta": "verdadeiro ou falso",
            "justificativa": "justificativa com base no contexto"
            }
            - Não crie perguntas que pergunte ou mencione qual é o dispositivo/artigo.
            - Não adicione nenhum texto antes ou depois do array, nem numeração ou rótulos. Apenas o array puro.
            - busque questões reais de certo e errado de concursos dos ultimos 5 anos da cespe ou outra banca adaptando para certo e errado
            - Sua resposta **deve começar com \`[\` e terminar com \`]\`** e conter apenas JSON válido.
            `
        }
    ];

    const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
        max_tokens: 1500,
        temperature: 0.7
    });

    const resp = response.choices[0].message.content;

    console.log("Resposta bruta do modelo:", resp);

    if (!resp.trim().startsWith('[') || !resp.trim().endsWith(']')) {
        throw new Error("Nenhum array JSON encontrado na resposta.");
    }

    let questoes;
    try {
        const arrayMatch = resp.match(/\[\s*{[\s\S]*?}\s*\]/); // pega o primeiro array JSON
        if (!arrayMatch) {
            throw new Error('Nenhum array JSON encontrado na resposta.');
        }

        questoes = JSON.parse(arrayMatch[0]);
    } catch (err) {
        console.error("Erro ao fazer parse do JSON da resposta da OpenAI:", err);
        console.error("Resposta recebida:", resp);
        throw err;
    }

    await indexQuestoesElastic(questoes, id_group, id_art, list_arts, id_origin_law);

    return
}

app.post('/gerar_questoes', async(req, res) => {
    const { id_group, id_art, id_origin_law, list_arts } = req.body;

    if (!id_group && !id_art && !id_origin_law) {
        return res.status(400).json({ error: 'Ids e prompts são obrigatórios.' });
    }

    try {
        await generateQuestoes(id_group, id_art, list_arts, id_origin_law);
        return res.send('Questões salvas com sucesso!');
    } catch (error) {
        console.error('Erro ao chamar a API da OpenAI:', error);
        res.status(500).json({ error: 'Erro ao gerar questoes.' });
    }

})

app.post('/generate_mapmind', async (req, res) => {
  const { texto } = req.body;

  if (!texto) {
    return res.status(400).json({ error: 'Texto é obrigatório.' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4', // ou 'gpt-4o'
      messages: [
        {
          role: 'system',
          content: `Você é um assistente jurídico especializado em transformar textos legais em mapas mentais estruturados.`,
        },
        {
          role: 'user',
          content: `
            A partir do texto a seguir, gere um mapa mental exclusivamente no formato JSON, conforme este modelo:

            {
                title: 'Título Principal',
                subtitle: 'Referência (Art. X)',
                type: 'root',
                level: 0,
                expanded: true,
                metadata: {
                    source: 'Lei Complementar X',
                    lastUpdate: '2024-01-01'
                },
            children: [
                {
                id: 'concept-1',
                title: 'Conceito Principal',
                description: 'Descrição do conceito...',
                type: 'concept',
                level: 1,
                expanded: false,
                children: [
                    {
                    id: 'definition-1',
                    title: 'Definição Específica',
                    subtitle: '§ 1º',
                    description: 'Explicação detalhada...',
                    type: 'definition',
                    level: 2,
                    expanded: false,
                    children: [
                        {
                        id: 'item-1',
                        title: 'Item Específico',
                        description: 'Detalhe do item...',
                        type: 'item',
                        level: 3,
                        icon: 'mdi-check-circle',
                        color: 'green'
                        }
                    ]
                    }
                ]
                },
                {
                id: 'exclusions',
                title: 'Exclusões',
                type: 'exclusion',
                level: 1,
                expanded: false,
                children: [
                    {
                    id: 'exclusion-1',
                    title: 'Primeira Exclusão',
                    description: 'Descrição da exclusão...',
                    type: 'item',
                    level: 2,
                    icon: 'mdi-minus-circle'
                    }
                ]
                }
            ]
            }

            Regras:
            - Gere um único JSON completo e bem formatado.
            - Não inclua nenhuma explicação fora do JSON.
            - Se necessário, divida o conteúdo internamente mas una tudo em um JSON final.
            - Respeite os níveis hierárquicos e use os tipos conforme o modelo: 'root', 'concept', 'definition', 'item', 'exclusion'.
            - Todos os campos exigidos devem ser preenchidos.

            Texto:
            ${texto}
        `,
        },
      ],
      temperature: 0.3,
      stream: false,
    });

    let content = response.choices[0].message.content;

    // Tenta limpar conteúdo solto antes/depois do JSON
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      content = content.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(content);
      return res.json({ mapamental: parsed });
    } catch (err) {
      // Tenta transformar em JSON com eval como fallback seguro (último recurso)
      try {
        const fixed = content
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Garante aspas nas chaves
          .replace(/'/g, '"'); // Troca aspas simples por duplas

        const parsedFixed = JSON.parse(fixed);
        return res.json({ mapamental: parsedFixed });
      } catch (innerErr) {
        console.warn('Falha ao transformar em JSON. Retornando conteúdo bruto.');
        return res.json({ mapamental: content });
      }
    }
  } catch (error) {
    console.error('Erro ao chamar a API da OpenAI:', error);
    res.status(500).json({ error: 'Erro ao gerar mapa mental.' });
  }
});

app.post('/sendMsgWhats', async (req, res) => {
  const { phone, msg } = req.body;
  console.log('phone', phone, 'msg', msg);
  try {
    const response = await fetch('https://redbot.redoctopus.com.br/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: process.env.REDBOT_API_KEY,
        destinatario: phone,
        mensagem: msg
      })
    })

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Para Vercel, exporte o app
export default app;