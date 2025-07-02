import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client } from '@elastic/elasticsearch';
import axios from 'axios';

// Carrega variáveis de ambiente
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Configuração Elasticsearch
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

// Rota principal
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Back Leges funcionando!', 
    status: 'ok',
    timestamp: new Date().toISOString(),
    routes: ['/', '/test', '/search']
  });
});

// Rota de teste
app.get('/test', async (req, res) => {
  try {
    // Teste básico do Elasticsearch
    const esHealth = await esClient.ping().catch(() => ({ body: false }));
    
    res.json({ 
      message: 'Teste OK!', 
      service: 'elasticsearch + anthropic',
      elasticsearch: esHealth.body ? 'conectado' : 'erro de conexão',
      env: process.env.NODE_ENV || 'production',
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY
    });
  } catch (error) {
    res.json({
      message: 'Teste parcial',
      error: error.message,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY
    });
  }
});

// Rota de busca principal
app.post('/search', async (req, res) => {
  try {
    const { query, filters } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query é obrigatória' });
    }

    // Busca no Elasticsearch
    let esResults = [];
    try {
      const searchResponse = await esClient.search({
        index: process.env.ES_INDEX || 'documentos',
        body: {
          query: {
            multi_match: {
              query: query,
              fields: ['title^2', 'content', 'description']
            }
          },
          size: 10
        }
      });
      
      esResults = searchResponse.body.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source
      }));
    } catch (esError) {
      console.error('Erro Elasticsearch:', esError.message);
    }

    // Processa com Anthropic (se tiver resultados)
    let anthropicResponse = null;
    if (process.env.ANTHROPIC_API_KEY && esResults.length > 0) {
      try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Com base nos seguintes documentos encontrados para a consulta "${query}", forneça um resumo útil:\n\n${esResults.map(doc => `Título: ${doc.title}\nConteúdo: ${doc.content?.substring(0, 500)}...`).join('\n\n')}`
          }]
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }
        });
        
        anthropicResponse = response.data.content?.[0]?.text;
      } catch (anthropicError) {
        console.error('Erro Anthropic:', anthropicError.message);
      }
    }
    
    res.json({ 
      success: true, 
      query,
      results: esResults,
      summary: anthropicResponse,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro na busca:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handler para Vercel - IMPORTANTE!
export default app;