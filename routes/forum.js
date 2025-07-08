import { Router } from 'express';
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Configuração da API da Anthropic
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Prompt base para análise jurídica
const BASE_PROMPT = `Você é um especialista em Legislação com ampla experiência em concursos públicos e ensino jurídico. Analise o texto legal fornecido e execute as seguintes tarefas:

TEXTO A ANALISAR:
[TEXTO_PLACEHOLDER]

TAREFAS A EXECUTAR:

1. RESPOSTA EM FORMATO JSON
Retorne suas análises no seguinte formato JSON:

\`\`\`json
{
  "palavras_chaves": ["palavra1", "palavra2", "palavra3", "..."],
  "texto": "Texto explicativo detalhado sobre o conteúdo legal, destacando pontos de atenção, implicações práticas e aspectos relevantes para estudantes e profissionais. Escreva como se fosse uma postagem de blog educativa.",
  "titulo": "Título atrativo e informativo para o conteúdo",
  "disciplina": "Nome da disciplina jurídica específica",
  "questoes": [
    {
      "enunciado": "Pergunta objetiva baseada no texto legal",
      "alternativas": {
        "a": "Alternativa A",
        "b": "Alternativa B", 
        "c": "Alternativa C",
        "d": "Alternativa D",
        "e": "Alternativa E"
      },
      "resposta_correta": "letra_correta",
      "justificativa": "Explicação detalhada da resposta com base no texto legal"
    }
  ]
}
\`\`\`

DIRETRIZES ESPECÍFICAS:

**Para as palavras-chave:**
* Extraia 8-12 termos jurídicos mais relevantes
* Inclua tanto conceitos gerais quanto específicos do texto
* Priorize termos que aparecem com frequência ou têm importância conceitual

**Para o texto explicativo:**
* Use linguagem acessível mas tecnicamente precisa
* Destaque implicações práticas e aplicações reais
* Mencione possíveis pegadinhas ou pontos de confusão
* Estruture em parágrafos bem organizados
* Tamanho: 300-500 palavras
* Formate com marcadores HTML quando necessário

**Para o título:**
* Seja específico e atrativo
* Inclua a lei/norma de referência quando relevante
* Use linguagem que desperte interesse do leitor

**Para as questões:**
* Crie 2-3 questões no estilo de concursos públicos
* Varie os níveis de dificuldade (básico, intermediário, avançado)
* Use pegadinhas típicas de provas (mas sem exagerar)
* Alternativas plausíveis e bem estruturadas
* Justificativas que citem expressamente o texto legal

**Critérios de Qualidade:**
* Precisão técnica absoluta
* Didática clara e objetiva
* Relevância prática para concursos
* Formatação JSON válida
* Coerência entre todos os elementos gerados

Execute todas as tarefas com excelência técnica e didática.`;

// Função para fazer chamada à API da Anthropic
async function callAnthropicAPI(prompt) {
  try {
    const response = await axios.post(ANTHROPIC_API_URL, {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Erro na chamada da API Anthropic:', error.response?.data || error.message);
    throw error;
  }
}

// Função para extrair JSON da resposta
function extractSanitizeAndValidateJSON(text) {
  try {
    let jsonText;

    // Extrai entre blocos markdown, se houver
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      jsonText = text;
    }

    // === Fase 1: Sanitize básico ===
    let sanitized = '';
    let insideString = false;
    let prevChar = '';

    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];

      if (char === '"' && prevChar !== '\\') {
        insideString = !insideString;
      }

      if (insideString) {
        if (char === '\n') {
          sanitized += '\\n';  // Escapa quebras de linha dentro de strings
        } else if (char === '\r') {
          continue; // Ignora carriage return
        } else if (char.charCodeAt(0) >= 0 && char.charCodeAt(0) <= 31 && char !== '\t') {
          continue; // Remove outros caracteres de controle invisíveis
        } else {
          sanitized += char;
        }
      } else {
        sanitized += char;
      }

      prevChar = char;
    }

    // === Fase 2: Tenta parsear ===
    try {
      return JSON.parse(sanitized);
    } catch (parseError) {
      console.error('Falha ao fazer JSON.parse. Tentando diagnosticar o problema...');

      // Diagnóstico extra: Mostra a linha com o erro
      const errorPosition = parseError.message.match(/position (\d+)/);
      if (errorPosition && errorPosition[1]) {
        const pos = parseInt(errorPosition[1], 10);

        const snippetSize = 50;
        const errorSnippet = sanitized.substring(Math.max(0, pos - snippetSize), pos + snippetSize);

        console.error(`Erro próximo da posição ${pos}:`);
        console.error('--- Contexto ao redor do erro ---');
        console.error(errorSnippet);
        console.error('---------------------------------');
      } else {
        console.error('Não foi possível identificar a posição exata do erro.');
      }

      throw parseError;
    }

  } catch (error) {
    console.error('Erro ao sanitizar e validar JSON:', error);
    return null;
  }
}

// Middleware para validar API key
function validateApiKey(req, res, next) {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Chave da API Anthropic não configurada',
      message: 'Configure a variável ANTHROPIC_API_KEY no arquivo .env'
    });
  }
  next();
}

// Função para indexar análise jurídica
async function indexarAnalise(analiseData, dados, esClient) {
  try {
    const documento = {
      id: generateId(),
      id_law: dados.id_law,
      art: dados.art,
      arts: dados.arts,
      name_law: dados.name_law,
      createdAt: dados.createdAt,
      timestamp: new Date().toISOString(),
      titulo: analiseData.titulo,
      disciplina: analiseData.disciplina,
      texto_original: dados.texto,
      texto: analiseData.texto,
      palavras_chaves: analiseData.palavras_chaves,
      questoes: analiseData.questoes,
      metadata: {
        text_length: dados.texto.length,
        model: 'claude-3-5-sonnet-20241022',
        processing_time: Date.now()
      }
    };

    const response = await esClient.index({
      index: 'blog_law_v2',
      id: documento.id,
      body: documento
    });

    console.log('✅ Análise indexada no Elasticsearch:', response._id);
    return documento.id;
  } catch (error) {
    console.error('❌ Erro ao indexar análise:', error);
    throw error;
  }
}

// Função para calcular complexidade
function calcularComplexidade(analiseData) {
  const fatores = {
    palavrasChave: analiseData.palavras_chaves.length,
    questoes: analiseData.questoes.length,
    tamanhoTexto: analiseData.texto.length
  };

  const score = (fatores.palavrasChave * 2) + (fatores.questoes * 3) + (fatores.tamanhoTexto / 100);
  
  if (score < 50) return 'baixa';
  if (score < 100) return 'media';
  return 'alta';
}

// Função para gerar ID único
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export default function createForumRouter({ openai, es }) {
    const router = Router();

    // Rota principal para análise jurídica
    router.post('/gerar_post', validateApiKey, async (req, res) => {
        const startTime = Date.now();
        try {
            const { texto } = req.body;
            const dados =  { ...req.body }

            // Validação do input
            if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
              return res.status(400).json({
                  error: 'Texto inválido',
                  message: 'O campo "texto" é obrigatório e deve conter o texto legal a ser analisado'
              });
            }

            if (texto.length > 50000) {
              return res.status(400).json({
                  error: 'Texto muito longo',
                  message: 'O texto deve ter no máximo 50.000 caracteres'
              });
            }

            const prompt = BASE_PROMPT.replace('[TEXTO_PLACEHOLDER]', texto.trim());

            // // Faz a chamada para a API da Anthropic
            console.log('Fazendo chamada para API Anthropic...');
            const anthropicResponse = await callAnthropicAPI(prompt);

            // // Extrai o conteúdo da resposta
            const content = anthropicResponse.content[0]?.text;
            if (!content) {
                throw new Error('Resposta vazia da API Anthropic');
            }

            console.log('content:', content);

            // // Extrai o JSON da resposta
            const analysisData = extractSanitizeAndValidateJSON(content);

            console.log('Análise estruturada extraída:', analysisData);
            
            if (!analysisData) {
                return res.status(500).json({
                    error: 'Erro no processamento',
                    message: 'Não foi possível extrair os dados estruturados da análise',
                    rawResponse: content
                });
            }

            //Indexar no Elasticsearch
            let analiseId = null;

            try {
                console.log('Indexando análise no Elasticsearch...');
                analiseId = await indexarAnalise(analysisData, dados, es);
            } catch (esError) {
                console.error('Erro ao indexar no Elasticsearch:', esError);
            }

            const processingTime = (Date.now() - startTime) / 1000;

            // Retorna a análise estruturada
            res.json({
                success: true,
                data: analysisData,
                elasticsearch: {
                    analise_id: analiseId,
                    indexed: !!(analiseId)
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    textLength: texto.length,
                    model: 'claude-3-5-sonnet-20241022',
                    processingTime: processingTime
                }
            });

        } catch (error) {
            console.error('Erro na análise do texto legal:', error);
            
            if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Erro de autenticação',
                message: 'Chave da API Anthropic inválida'
            });
            }

            if (error.response?.status === 429) {
            return res.status(429).json({
                error: 'Limite de requisições excedido',
                message: 'Muitas requisições. Tente novamente em alguns minutos.'
            });
            }

            res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message || 'Erro desconhecido na análise do texto'
            });
        }
    });

    // Rota de health check
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            anthropicConfigured: !!ANTHROPIC_API_KEY
        });
    });

    // Rota para informações da API
    router.get('/info', (req, res) => {
        res.json({
            name: 'API de Análise Jurídica',
            version: '1.0.0',
            description: 'API para análise de textos legais usando Anthropic Claude',
            endpoints: {
            'POST /api/analisar-texto-legal': 'Analisa texto legal e gera conteúdo educativo',
            'GET /api/health': 'Verifica status da API',
            'GET /api/info': 'Informações sobre a API'
            },
            requirements: {
            'ANTHROPIC_API_KEY': 'Chave da API Anthropic (obrigatória)'
            }
        });
    });

    // Rota para explicar dispositivo
    router.post('/explicar_dispositivo', validateApiKey, async (req, res) => {
      const { artigo, texto, num_art, law } = req.body;
    
      if (!texto && !artigo && !num_art && !law) {
        return res.status(400).json({ error: 'Campos obrigatórios.' });
      }

      if (texto.length > 50000) {
        return res.status(400).json({
            error: 'Texto muito longo',
            message: 'O texto deve ter no máximo 50.000 caracteres'
        });
      }

      const prompt = `Você é um especialista em Legislação com ampla experiência em concursos públicos e ensino jurídico. Analise o texto legal fornecido e execute as seguintes tarefas:
        TEXTO A ANALISAR: ${texto}

        TAREFAS A EXECUTAR:
        1. Explique detalhadamente o texto analisado que se refere ao aritgo ${num_art} da norma ${law}. O artigo na integra consta assim ${artigo}.
        2. Explique de forma estruturada.
        3. Informe a relação dele com outros dispositivos dentro da propria norma (${law}) e com outras normas.)
        4. Explique a relação dele com a jurisprudência do STF o STJ.
        
        DIRETRIZES ESPECÍFICAS:

        **Para o texto explicativo:**
        * Use linguagem acessível mas tecnicamente precisa
        * Destaque implicações práticas e aplicações reais
        * Mencione possíveis pegadinhas ou pontos de confusão
        * Estruture em parágrafos bem organizados
        * Tamanho: 300-500 palavras
        * Formate com marcadores HTML necessárioamente, incluvise com cores, negrito e italico, sublinhado quando quiser detacar algo

        * Use linguagem que desperte interesse do leitor

        **Critérios de Qualidade:**
        * Precisão técnica absoluta
        * Didática clara e objetiva
        * Relevância prática para concursos
        * Formatação em HTML adequada para melhor leitura com espaçamento adequado entre as linhas.
        * Coerência entre todos os elementos gerados

        Execute todas as tarefas com excelência técnica e didática.
      `;
    
      try {
        // // Faz a chamada para a API da Anthropic
        console.log('Fazendo chamada para API Anthropic...');
        const anthropicResponse = await callAnthropicAPI(prompt);

        // // Extrai o conteúdo da resposta
        const content = anthropicResponse.content[0]?.text;
        if (!content) {
            throw new Error('Resposta vazia da API Anthropic');
        }

        console.log('content:', content);

        // Retorna a análise estruturada
        res.json({
            success: true,
            data: content,
            metadata: {
                timestamp: new Date().toISOString(),
                textLength: texto.length,
                model: 'claude-3-5-sonnet-20241022',
            }
        });
          
      } catch (error) {
            console.error('Erro na análise do texto legal:', error);
            
            if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Erro de autenticação',
                message: 'Chave da API Anthropic inválida'
            });
            }

            if (error.response?.status === 429) {
            return res.status(429).json({
                error: 'Limite de requisições excedido',
                message: 'Muitas requisições. Tente novamente em alguns minutos.'
            });
            }

            res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message || 'Erro desconhecido na análise do texto'
            });
      }
    });

    // router.post('/analise-juridica', async (req, res) => {
    //   const sistema = new SistemaMultiagenteJuridico(process.env.ANTHROPIC_API_KEY);
      
    //   try {
    //     const resultado = await sistema.gerarAnaliseJuridica(req.body);
    //     res.json(resultado);
    //   } catch (error) {
    //     res.status(500).json({ erro: error.message });
    //   }
    // });

  return router;
}