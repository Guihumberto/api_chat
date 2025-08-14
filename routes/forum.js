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

    function buildLegalQuestionPrompt({ pergunta, banca, contexto, artigo, legislacao }) {
      const bancaInfo = banca ? `\nBanca organizadora: ${banca}` : '';
      
      return `Você é um especialista em Direito brasileiro com foco em concursos públicos e OAB. 

      CONTEXTO LEGISLATIVO:
      - Legislação: ${legislacao.nome} (${legislacao.numero || ''})
      - Artigo: ${artigo.numero}
      - Texto do artigo: "${artigo.texto || 'Não fornecido'}"${bancaInfo}

      PERGUNTA DO USUÁRIO:
      ${pergunta}

      INSTRUÇÕES PARA RESPOSTA:
      1. Seja preciso e objetivo, focando especificamente no artigo mencionado
      2. Se a pergunta for sobre jurisprudência, cite súmulas, decisões do STF/STJ com numeração específica
      3. Se for sobre legislações relacionadas, mencione os dispositivos específicos (artigos, incisos)
      4. Para questões de concurso, indique como o tema costuma ser cobrado e pegadinhas comuns
      5. Use linguagem técnica adequada, mas explicativa
      6. Sempre que possível, relacione com o contexto de concursos públicos e OAB
      7. Se mencionar banca específica, adapte o estilo de cobrança dessa banca
      8. Organize a resposta de forma didática com subtítulos quando necessário

      FORMATO ESPERADO:
      - Resposta direta à pergunta
      - Fundamentação jurídica
      - Aplicação prática
      - Dicas para concursos (quando aplicável)

      Responda de forma completa mas concisa, priorizando informações que realmente agreguem valor ao estudo para concursos.`;
    }

    // Função para processar e formatar a resposta
    function processLegalResponse(content, metadata) {
        try {
            // Debug: verificar o tipo e conteúdo recebido
            console.log('Content recebido:', { type: typeof content, content });

            let resposta;
            
            if (typeof content === 'string') {
                // Tentar fazer parse se for uma string JSON
                try {
                    const parsed = JSON.parse(content);
                    console.log('Content parseado:', parsed);
                    
                    if (Array.isArray(parsed)) {
                        // Se for array, procurar pelo texto no primeiro item
                        resposta = parsed[0]?.text || parsed[0]?.content || content;
                    } else if (parsed && typeof parsed === 'object') {
                        // Se for objeto, extrair texto
                        resposta = parsed.text || parsed.content || parsed.message || content;
                    } else {
                        resposta = content;
                    }
                } catch (parseError) {
                    // Se não conseguir fazer parse, usar como string normal
                    console.log('Não é JSON válido, usando como string:', parseError.message);
                    resposta = content;
                }
            } else if (content && typeof content === 'object') {
                // Se já for objeto
                if (Array.isArray(content)) {
                    resposta = content[0]?.text || content[0]?.content || JSON.stringify(content);
                } else {
                    resposta = content.text || content.content || content.message || content.response || JSON.stringify(content);
                }
            } else {
                // Fallback para outros tipos
                resposta = String(content);
            }

            // Verificar se resposta é válida
            if (!resposta || resposta.length === 0) {
                console.warn('Resposta vazia ou inválida');
                resposta = 'Desculpe, não foi possível processar sua pergunta. Tente novamente.';
            }

            // Garantir que resposta é string
            if (typeof resposta !== 'string') {
                resposta = String(resposta);
            }

            // Remover possíveis marcações desnecessárias
            resposta = resposta.replace(/```[\s\S]*?```/g, ''); // Remove blocos de código
            resposta = resposta.trim();

            // Identificar sugestões relacionadas (opcional)
            const suggestions = extractSuggestions(resposta, metadata);
            
            // Identificar tópicos relacionados
            const relatedTopics = extractRelatedTopics(resposta, metadata);

            // Formatar resposta para melhor legibilidade
            resposta = formatLegalResponse(resposta);

            console.log('Resposta processada:', { length: resposta.length, suggestions: suggestions.length });

            return {
                resposta,
                suggestions: suggestions.slice(0, 5), // Máximo 5 sugestões
                relatedTopics: relatedTopics.slice(0, 3) // Máximo 3 tópicos relacionados
            };

        } catch (error) {
            console.error('Erro ao processar resposta:', error);
            
            // Retorno seguro em caso de erro
            const fallbackResponse = typeof content === 'string' ? content : 'Erro ao processar resposta';
            
            return {
                resposta: fallbackResponse,
                suggestions: [],
                relatedTopics: []
            };
        }
    }

    // Função para extrair sugestões da resposta
    function extractSuggestions(resposta, metadata) {
        const suggestions = [];
        
        // Verificar se resposta é string
        if (typeof resposta !== 'string') {
            return suggestions;
        }
        
        try {
            // Sugestões baseadas no conteúdo da resposta
            if (resposta.toLowerCase().includes('súmula')) {
                suggestions.push('Consultar outras súmulas relacionadas');
            }
            
            if (resposta.toLowerCase().includes('jurisprudência')) {
                suggestions.push('Verificar jurisprudência mais recente');
            }
            
            if (resposta.toLowerCase().includes('doutrina')) {
                suggestions.push('Aprofundar estudo doutrinário');
            }

            if (metadata.banca) {
                suggestions.push(`Buscar questões anteriores da ${metadata.banca}`);
            }

            return suggestions;
        } catch (error) {
            console.error('Erro ao extrair sugestões:', error);
            return [];
        }
    }

    // Função para extrair tópicos relacionados
    function extractRelatedTopics(resposta, metadata) {
        const topics = [];
        
        // Verificar se resposta é string
        if (typeof resposta !== 'string') {
            return topics;
        }
        
        try {
            // Regex para identificar outros artigos mencionados
            const artigosRegex = /art(?:igo)?\.?\s*(\d+)/gi;
            const artigos = [...resposta.matchAll(artigosRegex)];
            
            const numeroArtigoAtual = metadata.artigo?.numero?.replace(/\D/g, '') || '';
            
            artigos.slice(0, 3).forEach(match => {
                if (match[1] !== numeroArtigoAtual) {
                    topics.push(`Artigo ${match[1]} da ${metadata.legislacao.nome}`);
                }
            });

            return topics;
        } catch (error) {
            console.error('Erro ao extrair tópicos relacionados:', error);
            return [];
        }
    }

    // Função para formatar a resposta legal
    function formatLegalResponse(resposta) {
        // Verificar se resposta é string
        if (typeof resposta !== 'string') {
            console.warn('formatLegalResponse: resposta não é string:', typeof resposta);
            return String(resposta);
        }

        try {
            // Destacar súmulas
            resposta = resposta.replace(/(Súmula \d+)/gi, '**$1**');
            
            // Destacar artigos
            resposta = resposta.replace(/(Art\.?\s*\d+)/gi, '**$1**');
            
            // Destacar incisos
            resposta = resposta.replace(/(inciso [IVX]+)/gi, '**$1**');
            
            // Melhorar formatação de parágrafos
            resposta = resposta.replace(/\n\n+/g, '\n\n');
            
            return resposta;
        } catch (error) {
            console.error('Erro na formatação da resposta:', error);
            return resposta; // Retorna sem formatação em caso de erro
        }
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

    router.post('/analise_texto', validateApiKey, async (req, res) => {
      const { textAnalise, art, dispositivo, norma } = req.body;

      if (!textAnalise) {
        return res.status(400).json({ error: 'Campos obrigatórios.' });
      }

      if (textAnalise.length > 50000) {
        return res.status(400).json({
          error: 'Texto muito longo',
          message: 'O texto deve ter no máximo 50.000 caracteres'
        });
      }

      try {
        console.log('Fazendo chamada para API Anthropic...');
        
        // Construir o prompt estruturado
        const prompt = `
          Você é um especialista em análise jurídica. Sua tarefa é analisar e melhorar o texto fornecido, seguindo estas instruções específicas:

          **CONTEXTO JURÍDICO:**
          - Norma: ${norma || 'Não especificada'}
          - Artigo: ${art || 'Não especificado'}
          - Dispositivo: ${dispositivo || 'Não especificado'}

          **INSTRUÇÕES DE PROCESSAMENTO:**

          1. **Melhoria do texto**: Corrija erros gramaticais, ortográficos e de pontuação. Melhore a clareza e fluidez do texto sem ser prolixo.

          2. **Processamento de marcadores especiais**:
            - Palavras com @ na frente (ex: @conceito): Forneça uma definição clara e concisa do conceito no contexto jurídico
            - Palavras com @(instruções)conceito: Execute a instrução específica entre dos parenteses para o conceito marcado

          3. **Formatação**: Retorne o texto em HTML bem estruturado com:
            - Parágrafos organizados
            - Definições de conceitos destacadas
            - Estrutura clara e legível

          4. **Contexto**: Mantenha todas as análises e melhorias dentro do contexto jurídico fornecido.

          **TEXTO PARA ANÁLISE:**
          ${textAnalise}

          **FORMATO DE RESPOSTA:**
          Retorne apenas o HTML formatado, sem explicações adicionais ou comentários fora do conteúdo solicitado.`;

        const anthropicResponse = await callAnthropicAPI(prompt);
        
        // Extrair o conteúdo da resposta
        let textoAnalisado = anthropicResponse.content?.[0]?.text || anthropicResponse.text || anthropicResponse;
        
        // Garantir que o texto está em formato HTML válido
        if (!textoAnalisado.includes('<')) {
          // Se não houver tags HTML, envolver em tags básicas
          textoAnalisado = `<div class="analise-juridica">${textoAnalisado.replace(/\n/g, '<br>')}</div>`;
        }

        // Resposta de sucesso
        res.status(200).json({
          success: true,
          data: {
            textoOriginal: textAnalise,
            textoAnalisado: textoAnalisado,
            contexto: {
              norma: norma || null,
              artigo: art || null,
              dispositivo: dispositivo || null
            },
            timestamp: new Date().toISOString(),
            caracteres: {
              original: textAnalise.length,
              analisado: textoAnalisado.length
            }
          },
          message: 'Análise de texto concluída com sucesso'
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

        if (error.response?.status === 400) {
          return res.status(400).json({
            error: 'Erro na requisição',
            message: 'Dados inválidos enviados para a API Anthropic'
          });
        }

        res.status(500).json({
          error: 'Erro interno do servidor',
          message: error.message || 'Erro desconhecido na análise do texto'
        });
      }
    });

    router.post('/chatquestion', validateApiKey, async (req, res) => {
        const { pergunta, banca, contexto, artigo, legislacao } = req.body;
        
        // Validações de entrada
        if (!artigo?.numero || !legislacao?.nome || !pergunta || !contexto) {
            return res.status(400).json({ error: 'Campos obrigatórios: artigo.numero, legislacao.nome, pergunta e contexto.' });
        }
        
        if (artigo.texto && artigo.texto.length > 50000) {
            return res.status(400).json({
                error: 'Texto muito longo',
                message: 'O texto do artigo deve ter no máximo 50.000 caracteres'
            });
        }

        if (pergunta.length > 1000) {
            return res.status(400).json({
                error: 'Pergunta muito longa',
                message: 'A pergunta deve ter no máximo 1.000 caracteres'
            });
        }

        try {
            // Construir o prompt especializado para questões jurídicas
            const prompt = buildLegalQuestionPrompt({
                pergunta,
                banca,
                contexto,
                artigo,
                legislacao
            });

            // Chamar a API da Anthropic
            const anthropicResponse = await callAnthropicAPI(prompt);

            if (!anthropicResponse || !anthropicResponse.content) {
                return res.status(500).json({
                    error: 'Erro na API da Anthropic',
                    message: 'Resposta inválida ou vazia'
                });
            }

            // Processar e formatar a resposta
            const processedResponse = processLegalResponse(anthropicResponse.content, {
                pergunta,
                artigo,
                legislacao,
                banca
            });

            // Log para auditoria (opcional)
            console.log(`[${new Date().toISOString()}] Pergunta processada:`, {
                legislacao: legislacao.nome,
                artigo: artigo.numero,
                banca: banca || 'não especificada',
                perguntaLength: pergunta.length,
                respostaLength: processedResponse.resposta.length
            });

            // Resposta de sucesso
            res.status(200).json({
                success: true,
                data: {
                    resposta: processedResponse.resposta,
                    metadata: {
                        legislacao: legislacao.nome,
                        artigo: artigo.numero,
                        banca: banca,
                        pergunta: pergunta,
                        processedAt: new Date().toISOString(),
                        tokensUsed: anthropicResponse.usage?.total_tokens || 0
                    },
                    suggestions: processedResponse.suggestions || [],
                    relatedTopics: processedResponse.relatedTopics || []
                }
            });

        } catch (error) {
            console.error('Erro ao processar pergunta jurídica:', {
                error: error.message,
                stack: error.stack,
                pergunta: pergunta.substring(0, 100) + '...',
                legislacao: legislacao.nome,
                artigo: artigo.numero
            });

            // Tratamento específico de erros
            if (error.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    error: 'Serviço temporariamente indisponível',
                    message: 'Erro de conexão com a API. Tente novamente em alguns minutos.'
                });
            }

            if (error.status === 429) {
                return res.status(429).json({
                    error: 'Limite de requisições excedido',
                    message: 'Muitas requisições. Aguarde alguns segundos antes de tentar novamente.',
                    retryAfter: error.headers?.['retry-after'] || 60
                });
            }

            if (error.status === 400) {
                return res.status(400).json({
                    error: 'Requisição inválida',
                    message: 'Verifique os dados enviados e tente novamente.'
                });
            }

            // Erro genérico
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: 'Ocorreu um erro ao processar sua pergunta. Tente novamente.'
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