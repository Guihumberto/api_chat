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

    async function debugAnthropicAPI() {
        try {
            const testPrompt = "Responda apenas com um JSON válido: [{\"test\": true}]";
            
            console.log('🧪 Testando API Anthropic...');
            console.log('Prompt de teste:', testPrompt);
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: testPrompt
                    }]
                })
            });

            console.log('Status da resposta:', response.status);
            console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));

            const data = await response.json();
            console.log('Dados completos da resposta:', JSON.stringify(data, null, 2));

            if (data.content && data.content[0] && data.content[0].text) {
                console.log('✅ Texto extraído:', data.content[0].text);
                console.log('✅ Tipo do texto:', typeof data.content[0].text);
            } else {
                console.log('❌ Estrutura inesperada na resposta');
            }

        } catch (error) {
            console.error('❌ Erro no teste:', error);
        }
    }

    async function callAnthropicAPIRobust(prompt) {
        try {
            console.log('🚀 Chamando API Anthropic...');
            
            const requestBody = {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            };
            
            console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Status da resposta:', response.status);
            
            // Ler a resposta como texto primeiro para debug
            const responseText = await response.text();
            console.log('📥 Resposta bruta (primeiros 500 chars):', responseText.substring(0, 500));

            if (!response.ok) {
                console.error('❌ Resposta não OK:', responseText);
                throw new Error(`Erro na API Anthropic: ${response.status} - ${responseText}`);
            }

            // Parse do JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('❌ Erro ao fazer parse do JSON:', jsonError);
                console.error('Texto completo da resposta:', responseText);
                throw new Error('Resposta da API não é um JSON válido');
            }
            
            console.log('✅ Dados parseados:', JSON.stringify(data, null, 2));
            
            // Verificar estrutura da resposta
            if (!data || typeof data !== 'object') {
                throw new Error('Resposta da API não é um objeto válido');
            }
            
            if (!data.content || !Array.isArray(data.content)) {
                throw new Error('Campo "content" não encontrado ou não é array');
            }
            
            if (data.content.length === 0) {
                throw new Error('Array "content" está vazio');
            }
            
            const content = data.content[0];
            if (!content || typeof content !== 'object') {
                throw new Error('Primeiro item do content não é válido');
            }
            
            if (content.type !== 'text') {
                throw new Error(`Tipo de conteúdo inesperado: ${content.type}`);
            }
            
            if (typeof content.text !== 'string') {
                throw new Error(`Campo "text" não é string: ${typeof content.text}`);
            }
            
            console.log('✅ Texto extraído com sucesso:', content.text.substring(0, 200) + '...');
            return content.text;
            
        } catch (error) {
            console.error('❌ Erro na chamada da API Anthropic:', error);
            
            // Se for erro de rede ou API, tentamos um fallback
            if (error.message.includes('fetch') || error.message.includes('network')) {
                console.log('🔄 Tentando novamente em 2 segundos...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Segunda tentativa
                try {
                    return await callAnthropicAPIRobust(prompt);
                } catch (retryError) {
                    console.error('❌ Segunda tentativa falhou:', retryError);
                    throw retryError;
                }
            }
            
            throw error;
        }
    }

    function generateFallbackTasks(planGeral, planning) {
    console.log('🆘 Gerando tarefas de fallback...');
    
    const tasks = [];
    let taskCounter = 0;
    
    // Garantir que planning.id existe
    const planningId = planning.id || Date.now();
    
    // Para cada legislação no plano
    planGeral.legislations.forEach(legislation => {
        const hours = planning.legislationHours[legislation.law.name] || 1;
        const tasksNeeded = Math.ceil(hours); // 1 tarefa por hora
        
        console.log(`📚 Criando ${tasksNeeded} tarefa(s) para ${legislation.law.name} (${hours}h)`);
        
        for (let i = 0; i < tasksNeeded; i++) {
            // Definir artigos baseado na legislação
            let startArt, endArt, arts;
            
            if (legislation.law.name.includes('CF88')) {
                // Constituição Federal - artigos mais importantes
                const cfArts = [
                    [1, 2, 3, 4], // Princípios fundamentais
                    [5, 6, 7, 8], // Direitos individuais
                    [37, 38, 39, 40], // Administração Pública
                    [70, 71, 72, 73] // Controle externo
                ];
                arts = cfArts[i] || [1 + (i * 4), 2 + (i * 4), 3 + (i * 4), 4 + (i * 4)];
            } else if (legislation.law.name.includes('CTN')) {
                // Código Tributário Nacional
                const ctnArts = [
                    [1, 2, 3], // Sistema Tributário
                    [16, 17, 18], // Tributos
                    [96, 97, 98], // Legislação Tributária
                    [114, 115, 116] // Crédito Tributário
                ];
                arts = ctnArts[i] || [1 + (i * 3), 2 + (i * 3), 3 + (i * 3)];
            } else {
                // Lei Complementar ou outras
                startArt = (legislation.lastArtStudy || 0) + (i * 3) + 1;
                endArt = startArt + 2;
                arts = Array.from({length: 3}, (_, idx) => startArt + idx);
            }
            
            // Criar relacionamentos fictícios mas plausíveis
            const artRefs = arts.map(art => ({
                art: art,
                ref: arts.filter(a => a !== art).slice(0, 2) // Relacionar com outros artigos da mesma tarefa
            }));
            
            tasks.push({
                id: `fallback_${planningId}_${taskCounter++}`,
                type: 'study',
                legislation: legislation.law.name,
                description: `Estudo dos artigos ${arts[0]} ao ${arts[arts.length - 1]} - ${legislation.law.name.replace(/ - .+/, '')}`,
                arts: arts,
                artRefs: artRefs,
                estimatedHours: hours <= 1 ? `${Math.round(hours * 60)}min` : '1h',
                status: 'pending',
                completedAt: null,
                createdAt: new Date().toISOString()
            });
        }
    });
    
    console.log(`✅ ${tasks.length} tarefas de fallback geradas com sucesso`);
    return tasks;
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
          id_law: dados.id_origin_law,
          id_forum: dados?.id_law || '',
          art: dados.nro_art,
          arts: dados?.arts || [],
          name_law: dados.lei,
          createdAt: formatDate(),
          timestamp: new Date().toISOString(),
          titulo: analiseData.titulo,
          disciplina: analiseData.disciplina,
          texto_original: dados.textoartigo,
          texto: analiseData.texto,
          palavras_chaves: analiseData.palavras_chaves,
          questoes: analiseData.questoes,
          metadata: {
            text_length: dados.textoartigo.length,
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
    
    function generateSuggestions(legislacao, artigo, disciplina) {
        const suggestions = [
            `Revisar outros artigos da ${legislacao}`,
            `Estudar jurisprudência relacionada ao artigo ${artigo}`,
            `Praticar mais questões sobre o tema`
        ];
        
        // Adicionar sugestões específicas da disciplina
        if (disciplina) {
            const disciplinaLower = disciplina.toLowerCase();
            
            if (disciplinaLower.includes('constitucional')) {
                suggestions.push('Estudar precedentes do STF sobre o tema');
                suggestions.push('Revisar ADI e ADPF relacionadas');
            } else if (disciplinaLower.includes('administrativo')) {
                suggestions.push('Consultar jurisprudência do STJ sobre atos administrativos');
                suggestions.push('Estudar pareceres da AGU');
            } else if (disciplinaLower.includes('penal')) {
                suggestions.push('Analisar súmulas do STJ e STF');
                suggestions.push('Revisar precedentes sobre o tipo penal');
            } else if (disciplinaLower.includes('civil')) {
                suggestions.push('Estudar enunciados das Jornadas de Direito Civil');
                suggestions.push('Revisar jurisprudência do STJ');
            } else if (disciplinaLower.includes('tributário') || disciplinaLower.includes('tributario')) {
                suggestions.push('Consultar jurisprudência dos tribunais superiores');
                suggestions.push('Estudar pareceres normativos da RFB');
            } else if (disciplinaLower.includes('trabalhista') || disciplinaLower.includes('trabalho')) {
                suggestions.push('Revisar súmulas do TST');
                suggestions.push('Estudar orientações jurisprudenciais');
            }
            
            suggestions.push(`Consultar doutrina especializada em ${disciplina}`);
        } else {
            suggestions.push('Consultar doutrina especializada');
        }
        
        return suggestions.slice(0, 6); // Limitar a 6 sugestões
    }

    function generateRelatedTopics(contexto, legislacao, disciplina) {
        const topics = [];
        
        // Tópicos baseados na disciplina
        if (disciplina) {
            const disciplinaLower = disciplina.toLowerCase();
            
            if (disciplinaLower.includes('constitucional')) {
                topics.push('Direitos Fundamentais', 'Organização do Estado', 'Controle de Constitucionalidade', 'Federalismo', 'Processo Legislativo');
            } else if (disciplinaLower.includes('administrativo')) {
                topics.push('Atos Administrativos', 'Processo Administrativo', 'Responsabilidade Civil do Estado', 'Licitações e Contratos', 'Servidores Públicos');
            } else if (disciplinaLower.includes('penal')) {
                topics.push('Teoria Geral do Crime', 'Penas e Medidas de Segurança', 'Crimes em Espécie', 'Execução Penal', 'Lei de Drogas');
            } else if (disciplinaLower.includes('civil')) {
                topics.push('Contratos', 'Responsabilidade Civil', 'Direitos Reais', 'Família e Sucessões', 'Obrigações');
            } else if (disciplinaLower.includes('processual civil')) {
                topics.push('Processo de Conhecimento', 'Execução', 'Recursos', 'Procedimentos Especiais', 'Tutelas Provisórias');
            } else if (disciplinaLower.includes('processual penal')) {
                topics.push('Inquérito Policial', 'Ação Penal', 'Provas', 'Recursos', 'Execução Penal');
            } else if (disciplinaLower.includes('tributário') || disciplinaLower.includes('tributario')) {
                topics.push('Sistema Tributário Nacional', 'Obrigação Tributária', 'Crédito Tributário', 'Processo Administrativo Tributário', 'Execução Fiscal');
            } else if (disciplinaLower.includes('trabalhista') || disciplinaLower.includes('trabalho')) {
                topics.push('Contrato de Trabalho', 'Jornada de Trabalho', 'Salário e Remuneração', 'FGTS e Previdência', 'Processo do Trabalho');
            } else if (disciplinaLower.includes('empresarial') || disciplinaLower.includes('comercial')) {
                topics.push('Sociedades', 'Títulos de Crédito', 'Falência e Recuperação', 'Contratos Empresariais', 'Propriedade Industrial');
            } else if (disciplinaLower.includes('ambiental')) {
                topics.push('Princípios do Direito Ambiental', 'Licenciamento Ambiental', 'Responsabilidade Ambiental', 'Áreas Protegidas', 'Crimes Ambientais');
            } else if (disciplinaLower.includes('previdenciário') || disciplinaLower.includes('previdenciario')) {
                topics.push('Segurados do RGPS', 'Benefícios Previdenciários', 'Custeio da Previdência', 'Processo Previdenciário', 'Previdência do Servidor');
            }
        }
        
        // Se não conseguiu identificar pela disciplina, usar a legislação
        if (topics.length === 0) {
            const legislacaoLower = legislacao.toLowerCase();
            if (legislacaoLower.includes('constituição') || legislacaoLower.includes('constitucional')) {
                topics.push('Direitos Fundamentais', 'Organização do Estado', 'Controle de Constitucionalidade');
            } else if (legislacaoLower.includes('código civil')) {
                topics.push('Contratos', 'Responsabilidade Civil', 'Direitos Reais');
            } else if (legislacaoLower.includes('código penal')) {
                topics.push('Teoria Geral do Crime', 'Penas e Medidas de Segurança');
            }
        }
        
        // Adicionar tópicos baseados no contexto
        if (contexto) {
            const contextWords = contexto.toLowerCase();
            if (contextWords.includes('servidor')) topics.push('Regime Jurídico dos Servidores');
            if (contextWords.includes('licitação')) topics.push('Lei de Licitações');
            if (contextWords.includes('improbidade')) topics.push('Lei de Improbidade Administrativa');
            if (contextWords.includes('responsabilidade')) topics.push('Responsabilidade Civil e Administrativa');
            if (contextWords.includes('processo')) topics.push('Direito Processual');
            if (contextWords.includes('recurso')) topics.push('Teoria Geral dos Recursos');
            if (contextWords.includes('execução')) topics.push('Processo de Execução');
        }
        
        // Remover duplicatas e limitar
        return [...new Set(topics)].slice(0, 8);
    }

    function inferDifficultyFromQuestion(pergunta, justificativa) {
        const texto = (pergunta + ' ' + justificativa).toLowerCase();
        
        // Palavras que indicam alta dificuldade
        const hardKeywords = [
            'excepcionalmente', 'ressalvado', 'salvo', 'entretanto', 'contudo',
            'jurisprudência', 'precedente', 'súmula', 'orientação jurisprudencial',
            'interpretação', 'doutrina', 'teoria', 'princípio', 'exceção'
        ];
        
        // Palavras que indicam dificuldade média
        const mediumKeywords = [
            'aplicação', 'procedimento', 'processo', 'requisito', 'condição',
            'prazo', 'competência', 'atribuição', 'responsabilidade'
        ];
        
        const hardCount = hardKeywords.filter(keyword => texto.includes(keyword)).length;
        const mediumCount = mediumKeywords.filter(keyword => texto.includes(keyword)).length;
        
        if (hardCount >= 2) return 'dificil';
        if (hardCount >= 1 || mediumCount >= 2) return 'medio';
        return 'facil';
    }

    function formatDate(){
            const now = new Date();
            
            const day = String(now.getDate()).padStart(2, '0');  // Garante 2 dígitos para o dia
            const month = String(now.getMonth() + 1).padStart(2, '0');  // Meses começam em 0, então somamos 1
            const year = now.getFullYear();
            
            const hours = String(now.getHours()).padStart(2, '0');  // Garante 2 dígitos para a hora
            const minutes = String(now.getMinutes()).padStart(2, '0');  // Garante 2 dígitos para os minutos
            
            return `${day}-${month}-${year} ${hours}:${minutes}`;
    }

    async function indexQuestoesElastic(allSplits, id_law, id_art, list_arts, id_origin_law, disciplina, banca, es) {
      try {
          const dataAtual = new Date();
          const ano = dataAtual.getFullYear();
          const bulkOperations = [];

          for (let i = 0; i < allSplits.length; i++) {
              const questao = allSplits[i];
              
              // Validar estrutura da questão
              if (!questao.pergunta || !questao.resposta || !questao.justificativa) {
                  console.warn(`Questão ${i + 1} com estrutura inválida, pulando...`);
                  continue;
              }

              const doc = {
                  ...questao,
                  id_origin_law: id_origin_law || null,
                  id_law: id_law || null,
                  id_art: id_art || null,
                  list_arts: list_arts || [],
                  tipo: 'c/e',
                  date_created: Date.now(),
                  created_by: 'admin',
                  banca: banca || 'GERADA POR IA',
                  id_disciplina: disciplina || null,
                  concurso: 'GERADA POR IA',
                  ano: ano,
                  // Campos adicionais úteis
                  status: 'ativa',
                  difficulty_level: inferDifficultyFromQuestion(questao.pergunta, questao.justificativa),
                  source_type: 'ai_generated',
                  version: '1.0',
                  status: "active"
              };

              // Preparar para bulk insert
              bulkOperations.push(
                  { index: { _index: 'questoes' } },
                  doc
              );
          }

          if (bulkOperations.length > 0) {
              // Usar bulk API para melhor performance
              const bulkResponse = await es.bulk({
                  refresh: true, // Refresh para disponibilizar imediatamente
                  body: bulkOperations
              });

              // Verificar erros no bulk insert
              if (bulkResponse.errors) {
                  const erroredDocuments = [];
                  bulkResponse.items.forEach((action, i) => {
                      const operation = Object.keys(action)[0];
                      if (action[operation].error) {
                          erroredDocuments.push({
                              status: action[operation].status,
                              error: action[operation].error,
                              document: bulkOperations[i * 2 + 1] // O documento correspondente
                          });
                      }
                  });
                  console.error('Erros na indexação em lote:', erroredDocuments);
              }

              const successfulDocs = bulkResponse.items.filter(item => {
                  const operation = Object.keys(item)[0];
                  return !item[operation].error;
              }).length;

              console.log(`${successfulDocs}/${allSplits.length} questões foram indexadas com sucesso no Elasticsearch!`);
              return { success: successfulDocs, total: allSplits.length, errors: bulkResponse.errors };
          } else {
              throw new Error('Nenhuma questão válida para indexar');
          }

      } catch (error) {
          console.error('Erro na função indexQuestoesElastic:', error);
          throw error;
      }
    }

    async function indexFlashcardsElastic(allSplits, id_law, id_art, list_arts, id_origin_law, disciplina, banca, es) {
          try {
              // Validar se há flashcards para indexar
              if (!allSplits || !Array.isArray(allSplits) || allSplits.length === 0) {
                  throw new Error('Nenhum flashcard válido para indexar');
              }

              // Validar estrutura de cada flashcard
              const validFlashcards = allSplits.filter((flashcard, index) => {
                  if (!flashcard.pergunta || !flashcard.resposta || !flashcard.nivel) {
                      console.warn(`Flashcard ${index + 1} com estrutura inválida, pulando...`);
                      return false;
                  }
                  return true;
              });

              if (validFlashcards.length === 0) {
                  throw new Error('Nenhum flashcard com estrutura válida encontrado');
              }

              // Calcular nível de dificuldade geral do conjunto
              const nivelCounts = validFlashcards.reduce((acc, card) => {
                  acc[card.nivel] = (acc[card.nivel] || 0) + 1;
                  return acc;
              }, {});

              const overallDifficulty = Object.keys(nivelCounts).reduce((a, b) => 
                  nivelCounts[a] > nivelCounts[b] ? a : b
              );

              // Criar documento único com array nested
              const doc = {
                  title: `Artigo ${id_art} - ${disciplina?.name_disciplina || 'Direito'}`,
                  flashcards: validFlashcards, // Array nested com todos os flashcards
                  typeGuide: 'laws_flashcards', // corrigir typo
                  icon: "mdi-card-text-outline",
                  disciplina: disciplina?.name_disciplina || 'Não especificada',
                  conteudo: `Flashcards do artigo ${id_art}`,
                  data_include: formatDate(),
                  id_origin_law: id_origin_law || null,
                  id_law: id_law || null,
                  id_art: id_art || null,
                  list_arts: list_arts || [],
                  created_by: 'admin',
                  id_disciplina: disciplina?.id_disciplina || null,
                  status: 'ativo',
                  difficulty_level: overallDifficulty, // dificuldade geral do conjunto
                  source_type: 'ai_generated',
                  version: '1.0',
                  banca: banca || 'GERADA POR IA',
                  // Campos específicos para o conjunto
                  total_flashcards: validFlashcards.length
              };

              // Indexar documento único
              const resp = await es.index({
                  index: 'guia_estudo',
                  body: doc,
                  refresh: true // Disponibilizar imediatamente
              });

              if (resp && resp.result) {
                  console.log(`Guia de flashcards indexado com sucesso! ID: ${resp._id}`);
                  return { 
                      success: true, 
                      total: validFlashcards.length, 
                      elasticId: resp._id,
                      index: resp._index,
                      result: resp.result 
                  };
              } else {
                  throw new Error('Falha na indexação do documento no Elasticsearch');
              }

          } catch (error) {
              console.error('Erro na função indexFlashcardsElastic:', error);
              throw error;
          }
    }

    async function indexMindMapElastic(allSplits, id_law, id_art, list_arts, id_origin_law, disciplina, banca, es) {
          try {
              // Validar se há flashcards para indexar
              if (!allSplits || !Array.isArray(allSplits) || allSplits.length === 0) {
                  throw new Error('Nenhum mapmind válido para indexar');
              }

              // Validar estrutura de cada flashcard
              const validMapMind = allSplits.filter((mapmind, index) => {
                  if (!mapmind.name || !mapmind.children.length) {
                      console.warn(`MindMap ${index + 1} com estrutura inválida, pulando...`);
                      return false;
                  }
                  return true;
              });

              if (validMapMind.length === 0) {
                  throw new Error('Nenhum mapmind com estrutura válida encontrado');
              }


              // Criar documento único com array nested
              const doc = {
                  title: `Artigo ${id_art} - ${disciplina?.name_disciplina || 'Direito'}`,
                  children: validMapMind, // Array nested com todos os flashcards
                  typeGuide: 'laws_mapmind', // corrigir typo
                  disciplina: disciplina?.name_disciplina || 'Não especificada',
                  subtitle: `Mapa mental do artigo ${id_art}`,
                  data_include: formatDate(),
                  id: id_origin_law || null,
                  id_group: id_law || null,
                  art: id_art || null,
                  list_arts: list_arts || [],
                  created_by: 'admin',
                  id_disciplina: disciplina?.id_disciplina || null,
                  status: 'ativo',
                  source_type: 'ai_generated',
                  version: '1.0',
                  banca: banca || 'GERADA POR IA',
              };

              // Indexar documento único
              const resp = await es.index({
                  index: 'mind_maps',
                  body: doc,
                  refresh: true // Disponibilizar imediatamente
              });

              if (resp && resp.result) {
                  console.log(`Guia de MndMap indexado com sucesso! ID: ${resp._id}`);
                  return { 
                      success: true, 
                      elasticId: resp._id,
                      index: resp._index,
                      result: resp.result 
                  };
              } else {
                  throw new Error('Falha na indexação do documento no Elasticsearch');
              }

          } catch (error) {
              console.error('Erro na função indexMindMapElastic:', error);
              throw error;
          }
    }

    async function indexNotasElastic(id_origin_law, id_law, list_arts, explicacao, disciplina, banca, area, cargo, es) {
          try {
              // Validar se há flashcards para indexar
              if (!list_arts || !Array.isArray(list_arts) || list_arts.length === 0) {
                  throw new Error('Nenhuma lista artigo válido para indexar');
              }

              // Criar documento
              const doc = {
                  id_law: id_origin_law || null,
                  id_group: id_law || null,
                  list_arts: list_arts || [],
                  texto: explicacao,
                  banca: banca || 'Principais',
                  area: area || 'Principais',
                  cargo: cargo || 'Principais',
                  disciplina: disciplina || 'Direito',
                  typeGuide: 'analise_law',
                  created_by: 'admin',
                  data_include: formatDate(),
                  status: 'ativo',
                  source_type: 'ai_generated',
                  version: '1.0',
              };

              // Indexar documento único
              const resp = await es.index({
                  index: 'notas_law',
                  body: doc,
                  refresh: true // Disponibilizar imediatamente
              });

              if (resp && resp.result) {
                  console.log(`Notas da Lei indexado com sucesso! ID: ${resp._id}`);
                  return { 
                      success: true, 
                      elasticId: resp._id,
                      index: resp._index,
                      result: resp.result 
                  };
              } else {
                  throw new Error('Falha na indexação do documento no Elasticsearch');
              }

          } catch (error) {
              console.error('Erro na função indexNotasElastic:', error);
              throw error;
          }
    }

    function parseEstimatedTime(estimatedHours) {
        if (typeof estimatedHours === 'string') {
            if (estimatedHours.includes('min')) {
            return parseInt(estimatedHours.replace(/\D/g, ''));
            } else if (estimatedHours.includes('h')) {
            const hours = parseFloat(estimatedHours.replace(/[^\d.]/g, ''));
            return Math.round(hours * 60);
            }
        }
        return 60; // default 1 hora
    }

    async function indexLegalTasks(planGeral, planning, tasks, stats, es) {
        try {
            // Preparar documento para indexação

            const endDate = new Date(planning.startDate)
            const daysToAdd = planning.cycleType === 'weekly' ? 7 : 15
            endDate.setDate(endDate.getDate() + daysToAdd - 1)

            const document = {
                planningId: Date.now(),
                generalPlanId: planGeral.idU || planGeral.id,
                targetExam: planGeral.targetExam,
                targetPosition: planGeral.targetPosition,
                examBoard: planGeral.examBoard,
                area: planGeral.area,
                cycleType: planning.cycleType,
                planningPeriod: {
                    startDate: planning.startDate,
                    endDate: endDate.toISOString().split('T')[0]
                },
                weeklyHours: planning.weeklyHours,
                includeWeekends: planning.includeWeekends,
                legislationHours: { ...planning.legislationHours }, 
                totalPlannedTasks: tasks.length,
                completedTasks: 0,
                status: 'active',
                tasks: tasks.map(task => ({
                    id: task?.id ? task.id : null,
                    type: task.type,
                    legislation: task.legislation,
                    description: task.description,
                    arts: task.arts,
                    artRefs: task.artRefs,
                    estimatedHours: task.estimatedHours,
                    estimatedMinutes: parseEstimatedTime(task.estimatedHours),
                    status: task.status,
                    completedAt: task.completedAt,
                    createdAt: task.createdAt
                })),
                statistics: {
                    totalTasks: stats.totalTasks,
                    totalEstimatedHours: Math.round(stats.totalEstimatedHours * 100) / 100,
                    legislationBreakdown: stats.legislationBreakdown,
                    completedTasks: 0,
                    pendingTasks: stats.totalTasks,
                    progressPercentage: 0.0
                },
                createdAt: new Date().toISOString(),
                createdBy: planGeral.createdUser,
                updatedAt: new Date().toISOString(),
                version: 1
            };

            // Indexar documento
            const response = await es.index({
                index: 'legal-tasks-index',
                body: document,
                refresh: true
            });

            console.log('Documento indexado com sucesso:', response);
            return { idU: response._id, ...document };

        } catch (error) {
            console.error('Erro ao indexar no Elasticsearch:', error);
            throw error;
        }
    }

    function parseAnthropicResponse(anthropicResponse) {
    console.log('🔍 Fazendo parse da resposta da IA...');
    
    if (typeof anthropicResponse !== 'string') {
        throw new Error(`Resposta não é string. Tipo: ${typeof anthropicResponse}`);
    }
    
    // Limpar a resposta
    let jsonString = anthropicResponse.trim();
    
    // Remover markdown code blocks
    jsonString = jsonString.replace(/^```(?:json)?\s*/gm, '').replace(/\s*```$/gm, '');
    
    // Procurar por array JSON na resposta
    const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        jsonString = arrayMatch[0];
    }
    
    console.log('📝 JSON limpo (primeiros 300 chars):', jsonString.substring(0, 300));
    
    try {
        const tasks = JSON.parse(jsonString);
        
        if (!Array.isArray(tasks)) {
            throw new Error(`Resultado não é array: ${typeof tasks}`);
        }
        
        if (tasks.length === 0) {
            throw new Error('Array de tarefas vazio');
        }
        
        // Validar e limpar cada tarefa
        return tasks.map((task, index) => {
            if (!task.legislation || !task.description) {
                throw new Error(`Tarefa ${index} inválida: faltam campos obrigatórios`);
            }
            
            return {
                id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
                type: task.type || 'study',
                legislation: task.legislation,
                description: task.description,
                arts: Array.isArray(task.arts) ? task.arts : [],
                artRefs: Array.isArray(task.artRefs) ? task.artRefs : [],
                estimatedHours: task.estimatedHours || '1h',
                status: 'pending',
                completedAt: null,
                createdAt: new Date().toISOString()
            };
        });
        
    } catch (parseError) {
        console.error('❌ Erro no parse JSON:', parseError);
        console.error('JSON que causou erro:', jsonString);
        throw new Error(`Erro no parse: ${parseError.message}`);
    }
    }

    // Função para calcular estatísticas
    function calculateTaskStats(tasks) {
        const stats = {
            totalTasks: tasks.length,
            totalEstimatedHours: 0,
            legislationBreakdown: {}
        };
        
        tasks.forEach(task => {
            // Calcular horas
            if (task.estimatedHours) {
                const hours = task.estimatedHours.includes('min') ? 
                    parseInt(task.estimatedHours.replace(/\D/g, '')) / 60 :
                    parseFloat(task.estimatedHours.replace(/[^\d.]/g, '')) || 1;
                stats.totalEstimatedHours += hours;
            }
            
            // Breakdown por legislação
            if (!stats.legislationBreakdown[task.legislation]) {
                stats.legislationBreakdown[task.legislation] = 0;
            }
            stats.legislationBreakdown[task.legislation]++;
        });
        
        stats.totalEstimatedHours = Math.round(stats.totalEstimatedHours * 100) / 100;
        return stats;
    }

     async function indexEstruturadoLaw(id, art, mapamental, es) {
        try {
 
            const document = {
                id,
                art,
                ...mapamental
            };

            // Indexar documento
            const response = await es.index({
                index: 'mind_maps',
                body: document,
                refresh: true
            });

            console.log('Documento indexado com sucesso:', response);
            return { idLaw: response._id, ...document };

        } catch (error) {
            console.error('Erro ao indexar no Elasticsearch:', error);
            throw error;
        }
    }


export default function createForumRouter({ openai, es }) {
    const router = Router();

    // Rota principal para análise jurídica
    router.post('/gerar_post', validateApiKey, async (req, res) => {
        const { lei, banca = null, disciplina = null, area = null, cargo = null, id_origin_law = null, id_law = null, comments, textoartigo, nro_art } = req.body;
        const startTime = Date.now();
        try {
            const texto = textoartigo + comments;
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
                typeresposta: 'createpost',
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
        1. Explique detalhadamente o texto analisado que se refere ao artigo ${num_art} da norma ${law}. O artigo na integra consta assim ${artigo}.
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
        * Use <div>, <p>, <h3>, <h4>, <strong>, <em>

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
            - Use <div>, <p>, <h3>, <h4>, <strong>, <em>
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

    router.post('/gerarQuestoesFlahscards', validateApiKey, async (req, res) => {
        const { pergunta, banca, contexto, artigo, legislacao, disciplina } = req.body;
        
        // Validações de entrada
        if (!artigo?.numero || !legislacao?.nome || !pergunta || !artigo.texto) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: artigo.numero, legislacao.nome, pergunta e contexto.' 
            });
        }
        
        if (artigo.texto && artigo.texto.length > 50000) {
            return res.status(400).json({
                error: 'Texto muito longo',
                message: 'O texto do artigo deve ter no máximo 50.000 caracteres'
            });
        }

        try {
            let prompt = '';
            
            if (pergunta === 'questoes') {
                // Prompt para questões de certo/errado
                prompt = `
                  Você é um especialista em concursos públicos e elaboração de questões jurídicas no estilo CESPE/CEBRASPE.

                  DADOS DO ARTIGO:
                  - Disciplina: ${disciplina?.name_disciplina || 'Não especificada'}
                  - Legislação: ${legislacao.nome}
                  - Artigo: ${artigo.numero}
                  - Texto: ${artigo.texto}
                  - Contexto adicional: ${banca ? `- Banca: ${banca}` : ''}

                  INSTRUÇÕES ESPECÍFICAS PARA ${disciplina?.name_disciplina?.toUpperCase() || 'DIREITO'}:
                  1. Crie questões de CERTO/ERRADO baseadas no conteúdo fornecido
                  2. Foque especificamente em ${disciplina?.name_disciplina || 'direito geral'}
                  3. Simule o estilo das bancas CESPE, FCC, FGV, VUNESP
                  4. Quantidade proporcional ao tamanho e complexidade do texto (mínimo 5, máximo 20)
                  5. Inclua conhecimentos relacionados da área de ${disciplina?.name_disciplina || 'direito'} quando relevante
                  6. Use jurisprudência, doutrina e outras legislações específicas de ${disciplina?.name_disciplina || 'direito'} 
                  7. NÃO mencione números de artigos ou dispositivos nas perguntas
                  8. Evite perguntas óbvias ou muito simples
                  9. Varie a dificuldade das questões
                  10. Contextualize com temas frequentes em concursos de ${disciplina?.name_disciplina || 'direito'}

                  FORMATO DE SAÍDA:
                  Retorne EXCLUSIVAMENTE um array JSON válido no formato:
                  [
                      {
                          "pergunta": "texto da pergunta",
                          "resposta": "verdadeiro ou falso",
                          "justificativa": "justificativa detalhada com base no contexto indicando o dispositivo e jurisprudencia ou outras legislações se houver"
                      }
                  ]

                  EXEMPLOS DE ESTILO:
                  - "É possível que..." 
                  - "Constitui hipótese de..."
                  - "Segundo a legislação..."
                  - "É correto afirmar que..."
                  - "A respeito do tema..."

                  Gere as questões:`;

            } else if (pergunta === 'flashcards') {
                              // Prompt para flashcards
                              prompt = `
                  Você é um especialista em educação jurídica e criação de flashcards para estudo.

                  DADOS DO ARTIGO:
                  - Disciplina: ${disciplina?.name_disciplina || 'Não especificada'}
                  - Legislação: ${legislacao.nome}
                  - Artigo: ${artigo.numero}
                  - Texto: ${artigo.texto}
                  - Contexto adicional: ${banca ? `- Banca: ${banca}` : ''}

                  INSTRUÇÕES ESPECÍFICAS PARA ${disciplina?.name_disciplina?.toUpperCase() || 'DIREITO'}:
                  1. Crie flashcards educativos baseados no conteúdo fornecido
                  2. Foque especificamente em ${disciplina?.name_disciplina || 'direito geral'}
                  3. Quantidade proporcional ao tamanho e complexidade do texto (mínimo 5, máximo 15)
                  4. Varie os níveis de dificuldade: facil, medio, dificil
                  5. Inclua conhecimentos complementares da área de ${disciplina?.name_disciplina || 'direito'}
                  6. Use casos práticos, jurisprudência e doutrina específica de ${disciplina?.name_disciplina || 'direito'}
                  7. NÃO mencione números de artigos ou dispositivos nas perguntas
                  8. Foque em conceitos, aplicações práticas e entendimento específico da disciplina
                  9. Relacione com temas cobrados em concursos e OAB na área de ${disciplina?.name_disciplina || 'direito'}

                  FORMATO DE SAÍDA:
                  Retorne EXCLUSIVAMENTE um array JSON válido no formato:
                  [
                      {
                          "pergunta": "texto da pergunta",
                          "resposta": "resposta completa e didática com justificativa",
                          "nivel": "facil, medio ou dificil (sem acentos)"
                      }
                  ]

                  CRITÉRIOS DE NÍVEL:
                  - facil: conceitos básicos, definições simples
                  - medio: aplicações práticas, relações entre conceitos
                  - dificil: casos complexos, interpretações avançadas, exceções

                  Gere os flashcards:
                `;
            } else {
                return res.status(400).json({
                    error: 'Tipo de pergunta inválido',
                    message: 'Use "questoes" para questões de certo/errado ou "flashcards" para flashcards'
                });
            }

            // Chamar a API da Anthropic
            const anthropicResponse = await callAnthropicAPI(prompt);
            
            // Processar a resposta
            let processedResponse;
            try {
                // Tentar extrair JSON da resposta
                let jsonContent = anthropicResponse.content[0].text;
                
                // Limpar possíveis caracteres extras antes e depois do JSON
                jsonContent = jsonContent.trim();
                
                // Extrair apenas o conteúdo entre colchetes se houver texto extra
                const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    jsonContent = jsonMatch[0];
                }
                
                // Parsear JSON
                const parsedData = JSON.parse(jsonContent);
                
                // Validar estrutura
                if (!Array.isArray(parsedData)) {
                    throw new Error('Resposta deve ser um array');
                }
                
                // Validar cada item do array
                parsedData.forEach((item, index) => {
                    if (pergunta === 'questoes') {
                        if (!item.pergunta || !item.resposta || !item.justificativa) {
                            throw new Error(`Item ${index + 1} não possui estrutura válida para questões`);
                        }
                        if (!['verdadeiro', 'falso'].includes(item.resposta.toLowerCase())) {
                            throw new Error(`Item ${index + 1}: resposta deve ser 'verdadeiro' ou 'falso'`);
                        }
                    } else if (pergunta === 'flashcards') {
                        if (!item.pergunta || !item.resposta || !item.nivel) {
                            throw new Error(`Item ${index + 1} não possui estrutura válida para flashcards`);
                        }
                        if (!['facil', 'medio', 'dificil'].includes(item.nivel.toLowerCase())) {
                            throw new Error(`Item ${index + 1}: nível deve ser 'facil', 'medio' ou 'dificil'`);
                        }
                    }
                });
                
                processedResponse = {
                    resposta: parsedData,
                    suggestions: generateSuggestions(legislacao.nome, artigo.numero, disciplina?.name_disciplina),
                    relatedTopics: generateRelatedTopics(contexto.textoArtigo, legislacao.nome, disciplina?.name_disciplina)
                };
                
            } catch (parseError) {
                console.error('Erro ao processar resposta da IA:', parseError);
                return res.status(500).json({
                    error: 'Erro ao processar resposta',
                    message: 'A IA não retornou um formato válido. Tente novamente.'
                });
            }
          if (pergunta === 'questoes'){
            try {
              await indexQuestoesElastic(
                processedResponse.resposta, 
                legislacao.group, 
                legislacao.art, 
                legislacao.arts, 
                legislacao.id, 
                disciplina?.id_disciplina, 
                banca || null,  
                es
              );
              console.log('questoes indexadas');

            } catch (error) {
              console.error('Erro ao indexar questões no Elasticsearch:', error);
            }
          } else if (pergunta === 'flashcards') {
            try {
                const resp = await indexFlashcardsElastic(
                  processedResponse.resposta,
                  legislacao.group, 
                  legislacao.art, 
                  legislacao.arts, 
                  legislacao.id, 
                  disciplina, 
                  banca || null,
                  es
               );
               console.log('flashcards indexados', resp);
            } catch (error) {
              console.error('Erro ao indexar flashcards no Elasticsearch:', error);
            }

          } else {
            console.log('error nao gravas no elastic');
          }
            
          // Resposta de sucesso
          res.status(200).json({
                success: true,
                data: {
                    resposta: processedResponse.resposta,
                    typeresposta: pergunta,
                    metadata: {
                        disciplina: disciplina?.name_disciplina || 'Não especificada',
                        legislacao: legislacao.nome,
                        artigo: artigo.numero,
                        banca: banca || 'Não especificada',
                        tipo: pergunta,
                        totalItens: processedResponse.resposta.length,
                        processedAt: new Date().toISOString(),
                        tokensUsed: anthropicResponse.usage?.input_tokens + anthropicResponse.usage?.output_tokens || 0
                    },
                    suggestions: processedResponse.suggestions || [],
                    relatedTopics: processedResponse.relatedTopics || []
                }
          });

        } catch (error) {
            console.error('Erro ao processar pergunta jurídica:', {
                error: error.message,
                stack: error.stack,
                disciplina: disciplina?.name_disciplina || 'Não especificada',
                legislacao: legislacao.nome,
                artigo: artigo.numero
            });

            // Tratamento específico de erores
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
                    message: 'Verifique os dados enviados e tente novamente.',
                    details: error.message
                });
            }

            // Erro genérico
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: 'Ocorreu um erro ao processar sua pergunta. Tente novamente.',
                errorId: `ERR_${Date.now()}`
            });
        }
    });

    router.post('/gerarMindMap', validateApiKey, async (req, res) => {
        const { pergunta, banca, contexto, artigo, legislacao, disciplina } = req.body;
        
        // Validações de entrada
        if (!artigo?.numero || !legislacao?.nome || !pergunta || !artigo.texto) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: artigo.numero, legislacao.nome, pergunta e contexto.' 
            });
        }
        
        if (artigo.texto && artigo.texto.length > 50000) {
            return res.status(400).json({
                error: 'Texto muito longo',
                message: 'O texto do artigo deve ter no máximo 50.000 caracteres'
            });
        }

        try {
                let prompt = `
                  Você é um especialista em concursos públicos especializado em transformar textos legais em mapas mentais estruturados.

                  DADOS DO ARTIGO:
                  - Disciplina: ${disciplina?.name_disciplina || 'Não especificada'}
                  - Legislação: ${legislacao.nome}
                  - Artigo: ${artigo.numero}
                  - Texto: ${artigo.texto}
                  - Contexto adicional: ${banca ? `- Banca: ${banca}` : ''}

                  INSTRUÇÕES ESPECÍFICAS PARA ${disciplina?.name_disciplina?.toUpperCase() || 'DIREITO'}:
                  1. Foque especificamente em ${disciplina?.name_disciplina || 'direito geral'}
                  2. Inclua conhecimentos relacionados da área de ${disciplina?.name_disciplina || 'direito'} quando relevante
                  3. Use jurisprudência, doutrina e outras legislações específicas de ${disciplina?.name_disciplina || 'direito'} 
                  4. Contextualize com temas frequentes em concursos de ${disciplina?.name_disciplina || 'direito'}
                  5. Respeite os níveis hierárquicos e use os tipos conforme o modelo
                  6. Todos os campos exigidos devem ser preenchidos.
                  7. Pode haver mais níveis, dependendo da complexidade (children) do texto
                  8. Siga a estrutura da biblioteca vue3-mindmap que ira renderizar no front
                  9. inclua Emoji para serem exibidos quando relacionado com o texto, para facilitar a memorização

                  EXEMPLO DE FORMATO DE SAÍDA:
                  Retorne EXCLUSIVAMENTE um array JSON válido no formato:
                  [
                    {
                        "name": " How to learn D3 ",
                        "children": [
                        {
                            "name": " preliminary knowledge ",
                            "children": [
                                { "name": "HTML & CSS" },
                                { "name": "JavaScript" },
                                { "name": "DOM" },
                                { "name": "SVG" },
                                { "name": "test\ntest" }
                            ]
                        },
                        {
                            "name": " installation ",
                            "collapse": true,
                            "children": [{ "name": " folded node " }]
                        },
                        {
                            "name": " Getting Started ",
                            "children": [
                            { "name": " selection " },
                            { "name": "test" },
                            { "name": " Binding Data " },
                            { "name": " Add and remove elements " },
                            {
                                "name": " Simple Graphics ",
                                "children": [
                                { "name": " Histogram " },
                                { "name": " line chart " },
                                { "name": " scatterplot " }
                                ]
                            },
                            { "name": " scale " },
                            { "name": " Generator " },
                            { "name": " transition " }
                            ],
                            "left": true
                        },
                        {
                            "name": " Advanced ",
                            "left": true
                        },
                        {
                            "name": " level one node ",
                            "children": [
                            { "name": " child node 1 " },
                            { "name": " child node 2 " },
                            { "name": " child node 3 " }
                            ]
                        }
                        ]
                    }
                 ]
 
                  Gere o mapa mental:`;


            // Chamar a API da Anthropic
            const anthropicResponse = await callAnthropicAPI(prompt);
            
            // Processar a resposta
            let processedResponse;
            try {
                // Tentar extrair JSON da resposta
                let jsonContent = anthropicResponse.content[0].text;
                
                // Limpar possíveis caracteres extras antes e depois do JSON
                jsonContent = jsonContent.trim();
                
                // Extrair apenas o conteúdo entre colchetes se houver texto extra
                const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    jsonContent = jsonMatch[0];
                }
                
                // Parsear JSON
                const parsedData = JSON.parse(jsonContent);
                
                // Validar estrutura
                if (!Array.isArray(parsedData)) {
                    throw new Error('Resposta deve ser um array');
                }
                
        
                
                processedResponse = {
                    resposta: parsedData,
                    suggestions: generateSuggestions(legislacao.nome, artigo.numero, disciplina?.name_disciplina),
                    relatedTopics: generateRelatedTopics(contexto.textoArtigo, legislacao.nome, disciplina?.name_disciplina)
                };
                
            } catch (parseError) {
                console.error('Erro ao processar resposta da IA:', parseError);
                return res.status(500).json({
                    error: 'Erro ao processar resposta',
                    message: 'A IA não retornou um formato válido. Tente novamente.'
                });
            }
            

            try {
              await indexMindMapElastic(
                processedResponse.resposta,
                legislacao.group, 
                legislacao.art, 
                legislacao.arts, 
                legislacao.id, 
                disciplina, 
                banca || null,
                es
              );
              console.log('mindmpa indexadas');

            } catch (error) {
              console.error('Erro ao indexar questões no Elasticsearch:', error);
            }
            
          // Resposta de sucesso
          res.status(200).json({
                success: true,
                data: {
                    resposta: processedResponse.resposta,
                    typeresposta: 'mindmap',
                    metadata: {
                        disciplina: disciplina?.name_disciplina || 'Não especificada',
                        legislacao: legislacao.nome,
                        artigo: artigo.numero,
                        banca: banca || 'Não especificada',
                        tipo: pergunta,
                        totalItens: processedResponse.resposta.length,
                        processedAt: new Date().toISOString(),
                        tokensUsed: anthropicResponse.usage?.input_tokens + anthropicResponse.usage?.output_tokens || 0
                    },
                    suggestions: processedResponse.suggestions || [],
                    relatedTopics: processedResponse.relatedTopics || []
                }
          });

        } catch (error) {
            console.error('Erro ao processar pergunta jurídica:', {
                error: error.message,
                stack: error.stack,
                disciplina: disciplina?.name_disciplina || 'Não especificada',
                legislacao: legislacao.nome,
                artigo: artigo.numero
            });

            // Tratamento específico de erores
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
                    message: 'Verifique os dados enviados e tente novamente.',
                    details: error.message
                });
            }

            // Erro genérico
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: 'Ocorreu um erro ao processar sua pergunta. Tente novamente.',
                errorId: `ERR_${Date.now()}`
            });
        }
    });

    router.post('/create-estrutura', validateApiKey, async (req, res) => {
        const { lei, banca = null, disciplina = null, area = null, cargo = null, id_origin_law = null, id_law = null, comments, textoartigo, nro_art } = req.body;

        // Validações de entrada
        if (!lei) {
            return res.status(400).json({ 
                error: 'Campo obrigatório: nome da lei.' 
            });
        }

        if (lei && lei.length > 200) {
            return res.status(400).json({
                error: 'Nome da lei muito longo',
                message: 'O nome da lei deve ter no máximo 200 caracteres'
            });
        }

        try {
            const prompt = `
                Você é um assistente jurídico especializado em transformar textos legais em mapas mentais estruturados.

                **LEGISLAÇÃO:** ${lei}
                **BANCA:** ${banca || 'Todas as principais (CESPE/CEBRASPE, FCC, VUNESP, FGV, etc.)'}
                **DISCIPLINA:** ${disciplina || 'Multidisciplinar'}
                **ÁREA:** ${area || 'Todas as principais'}
                **CARGO:** ${cargo || 'Todos os principais'}
                **Texto do Artigo:** ${textoartigo || ''}
                **Commentarios do Artigo:** ${comments || ''}

                Instruções para a busca:
                1. A partir dos dados acima gere um mapa mental exclusivamente no formato JSON, conforme este modelo
                2. Utilize o Texto do Artigo prioritariamente para gerar o mapa mental
                3. Use os Comentários do Artigo de forma complementar para enriquecer a estrutura
                4. Utilize os outros dados de maneira a dar foco

                **IMPORTANTE:** Retorne APENAS o JSON abaixo, sem texto antes ou depois:

                {
                    "title": "Título Principal",
                    "subtitle": "Referência (Art. X)",
                    "type": "root",
                    "level": 0,
                    "expanded": true,
                    "metadata": {
                        "source": "Lei Complementar X",
                        "lastUpdate": "2024-01-01"
                    },
                    "children": [
                        {
                            "id": "concept-1",
                            "title": "Conceito Principal",
                            "description": "Descrição do conceito...",
                            "type": "concept",
                            "level": 1,
                            "expanded": false,
                            "children": [
                                {
                                    "id": "definition-1",
                                    "title": "Definição Específica",
                                    "subtitle": "§ 1º",
                                    "description": "Explicação detalhada...",
                                    "type": "definition",
                                    "level": 2,
                                    "expanded": false,
                                    "children": [
                                        {
                                            "id": "item-1",
                                            "title": "Item Específico",
                                            "description": "Detalhe do item...",
                                            "type": "item",
                                            "level": 3,
                                            "icon": "mdi-check-circle",
                                            "color": "green"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "id": "exclusions",
                            "title": "Exclusões",
                            "type": "exclusion",
                            "level": 1,
                            "expanded": false,
                            "children": [
                                {
                                    "id": "exclusion-1",
                                    "title": "Primeira Exclusão",
                                    "description": "Descrição da exclusão...",
                                    "type": "item",
                                    "level": 2,
                                    "icon": "mdi-minus-circle"
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
                - Use aspas duplas em todas as propriedades JSON.`;

            // Chamada para a API da Anthropic
            const anthropicResponse = await callAnthropicAPI(prompt);

            if (!anthropicResponse || !anthropicResponse.content || !anthropicResponse.content[0]) {
                return res.status(500).json({
                    error: 'Erro na resposta da IA',
                    message: 'A IA não retornou uma resposta válida'
                });
            }

            // Extrair o conteúdo da resposta
            let content = anthropicResponse.content[0].text;

            if (!content) {
                return res.status(500).json({
                    error: 'Conteúdo vazio da IA',
                    message: 'A IA retornou um conteúdo vazio'
                });
            }

            // Processar e limpar o conteúdo JSON (similar ao código OpenAI)
            // Remove possível texto antes e depois do JSON
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1) {
                content = content.substring(firstBrace, lastBrace + 1);
            }

            try {
                // Primeira tentativa: parse direto
                const parsed = JSON.parse(content);
                
                // Validar se tem a estrutura básica esperada
                if (!parsed.title || !parsed.type || !Array.isArray(parsed.children)) {
                    throw new Error('Estrutura JSON inválida');
                }

                const respel = await indexEstruturadoLaw(id_origin_law, nro_art, parsed, es)

                console.log('respel', respel);

                return res.json({ mapamental: parsed, typeresposta: 'createestrututura' });

            } catch (parseError) {
                console.warn('Primeira tentativa de parse falhou:');
                
                // Segunda tentativa: limpeza e correção do JSON
                try {
                    const fixedContent = content
                        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Garante aspas nas chaves
                        .replace(/'/g, '"') // Troca aspas simples por duplas
                        .replace(/,\s*}/g, '}') // Remove vírgulas desnecessárias antes de }
                        .replace(/,\s*]/g, ']') // Remove vírgulas desnecessárias antes de ]
                        .trim();

                    const parsedFixed = JSON.parse(fixedContent);
                    
                    // Validar estrutura novamente
                    if (!parsedFixed.title || !parsedFixed.type || !Array.isArray(parsedFixed.children)) {
                        throw new Error('Estrutura JSON inválida após correção');
                    }

                    await indexEstruturadoLaw(id_origin_law, nro_art, parsedFixed, es)

                    return res.json({ mapamental: parsedFixed, typeresposta: 'createestrututura' });

                } catch (secondParseError) {
                    console.error('Segunda tentativa de parse também falhou:');
                    console.error('Conteúdo problemático:');
                    
                    // Última tentativa: retornar estrutura padrão com erro
                    return res.status(422).json({
                        error: 'Erro ao processar JSON da IA',
                        message: 'Não foi possível converter a resposta da IA em JSON válido',
                        rawContent: content.substring(0, 500) + '...', // Primeiros 500 chars para debug
                        mapamental: {
                            title: lei || 'Erro no processamento',
                            subtitle: 'Erro de parsing',
                            type: 'root',
                            level: 0,
                            expanded: true,
                            metadata: {
                                source: lei,
                                lastUpdate: new Date().toISOString().split('T')[0],
                                error: true
                            },
                            children: [{
                                id: 'error-1',
                                title: 'Erro no processamento',
                                description: 'Houve um problema ao processar o conteúdo legal. Tente novamente.',
                                type: 'concept',
                                level: 1,
                                expanded: false,
                                children: []
                            }]
                        },
                        typeresposta: 'createestrututura'
                    });
                }
            }

        } catch (error) {
            console.error('Erro ao processar análise de artigos:', error);
            
            return res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message || 'Erro desconhecido ao processar a requisição'
            });
        }
    });

    router.post('/resumir', validateApiKey, async (req, res) => {
        const { texto, legislacao = null, orientacao = null } = req.body;

        if (!texto) {
            return res.status(400).json({ 
                error: 'Campo obrigatório: texto do resumo.' 
            });
        }

        if (texto && texto.length > 50000) {
            return res.status(400).json({
                error: 'Texto muito longo',
                message: 'O texto do artigo deve ter no máximo 50.000 caracteres'
            });
        }

        try {
              const prompt = `
                Você é um especialista em Direito com foco em concursos públicos e OAB. Analise o seguinte artigo jurídico e forneça um resumo completo seguindo as instruções:

                ${legislacao ? `**LEGISLAÇÃO:** ${legislacao}` : ''}
                ${orientacao ? `**ORIENTAÇÃO ESPECIAL:** ${orientacao}` : ''}

                **TEXTO DO ARTIGO:**
                ${texto}

                **INSTRUÇÕES:**
                1. Retorne APENAS código HTML bem formatado (sem tags html, head ou body)
                2. Inicie com uma síntese breve do que trata o artigo
                3. Faça um resumo focado em concursos públicos e OAB
                4. Use cores para destacar elementos importantes (mas mantenha tamanho padrão)
                5. Use emojis moderadamente para tornar a leitura agradável
                6. Explique conceitos jurídicos importantes que apareçam no texto
                7. Caso o  artigo ou algum dos seus dispositivos tenha sido revogado ou anulado informe e fundamente
                8. entre uma seção e outra dê quebras de linha com a tag <br>
                9. Crie uma seção "Aprofundando" com:
                - Dispositivos correlatos da mesma lei ou outras normas
                - Jurisprudência do STF/STJ (se relevante)
                - Doutrina relevante

                **FORMATO HTML DESEJADO:**
                - Use <div>, <p>, <h3>, <h4>, <strong>, <em>
                - Use cores como: <span style="color: #d32f2f"> para alertas, <span style="color: #1976d2"> para conceitos, <span style="color: #388e3c"> para jurisprudência
                - Estruture bem o conteúdo com divisões claras
                - Mantenha profissionalismo mesmo com emojis

                Foque em aspectos práticos para concursos e OAB, destacando pontos que costumam ser cobrados em provas ou como podem ser abordados.`;

            const anthropicResponse = await callAnthropicAPI(prompt);

            if (!anthropicResponse || !anthropicResponse.content || !anthropicResponse.content[0]) {
                return res.status(500).json({
                    error: 'Erro na resposta da IA',
                    message: 'A IA não retornou uma resposta válida'
                });
            }

            const resumoHTML = anthropicResponse.content[0].text;

            // Validação básica do HTML retornado
            if (!resumoHTML || resumoHTML.trim().length === 0) {
                return res.status(500).json({
                    error: 'Resumo vazio',
                    message: 'A IA retornou um resumo vazio'
                });
            }

            // Resposta de sucesso
            res.status(200).json({
                success: true,
                data: {
                    resumo: resumoHTML,
                    legislacao: legislacao,
                    orientacao: orientacao,
                    caracteres_originais: texto.length,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Erro ao processar resumo:', error);
            
            // Tratamento de diferentes tipos de erro
            if (error.response) {
                // Erro da API da Anthropic
                return res.status(error.response.status || 500).json({
                    error: 'Erro na API da Anthropic',
                    message: error.response.data?.error?.message || 'Erro desconhecido na IA',
                    details: error.response.status === 429 ? 'Limite de taxa excedido. Tente novamente em alguns minutos.' : null
                });
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                // Erro de conexão
                return res.status(503).json({
                    error: 'Erro de conexão',
                    message: 'Não foi possível conectar com a API da Anthropic'
                });
            } else {
                // Erro genérico
                return res.status(500).json({
                    error: 'Erro interno do servidor',
                    message: 'Erro inesperado ao processar o resumo'
                });
            }
        }
    });

    router.post('/artigos-importantes', validateApiKey, async (req, res) => {
        const { lei, banca = null, disciplina = null, area = null, cargo = null, id_origin_law = null, id_law = null } = req.body;

        if (!lei) {
            return res.status(400).json({ 
                error: 'Campo obrigatório: nome da lei.' 
            });
        }

        if (lei && lei.length > 200) {
            return res.status(400).json({
                error: 'Nome da lei muito longo',
                message: 'O nome da lei deve ter no máximo 200 caracteres'
            });
        }

        try {
            console.log('entrou 1');
            // Prompt melhorado para garantir resposta em JSON
            const prompt = `
                Você é um especialista em concursos públicos e OAB. Analise a legislação e retorne APENAS um JSON válido sem texto adicional.

                **LEGISLAÇÃO:** ${lei}
                **BANCA:** ${banca || 'Todas as principais (CESPE/CEBRASPE, FCC, VUNESP, FGV, etc.)'}
                **DISCIPLINA:** ${disciplina || 'Multidisciplinar'}
                **ÁREA:** ${area || 'Todas as principais'}
                **CARGO:** ${cargo || 'Todos os principais'}

                instrucoes para a busca
                1. faça as buscas em questoes reais dos ultimos 5 anos na banca informada
                2. Cite um resumo das jurisprudencias e doutrina encontradas desde que ainda vigentes
                3. as conexoes com legislacoes devem estar vigentes (nao revogadas ou anuladas)


                **IMPORTANTE:** Retorne APENAS o JSON abaixo, sem texto antes ou depois:

                {
                "artigos_importantes": [1, 2, 5, 10, 15],
                "explicacao_html": "<div><h3>📊 Artigos Mais Cobrados - Regra de Pareto</h3><p>Com base na análise dos últimos 5 anos de concursos...</p><h4>🎯 Art. 1 - [Tema]</h4><p><strong>Frequência:</strong> Muito Alta | <strong>Dificuldade:</strong> [Nível]</p><p>[Explicação do artigo...]</p><p><span style='color: #1976d2'><strong>Conexões:</strong></span> [outros artigos...]</p><p><span style='color: #388e3c'><strong>Jurisprudência:</strong></span> [STF/STJ...]</p><p><span style='color: #f57c00'><strong>Doutrina:</strong></span> [autores...]</p><p><span style='color: #d32f2f'><strong>⚠️ Pegadinhas:</strong></span> [cuidados...]</p><br></div>",
                "banca_analisada": "${banca || 'Todas as principais'}",
                "disciplina_analisada": "${disciplina || 'Multidisciplinar'}",
                "area_analisada": "${area || 'Todas as principais'}",
                "cargo_analisado": "${cargo || 'Todos os principais'}",
                "total_artigos_identificados": 5
                }

                INSTRUÇÕES PARA O HTML:
                - Use aspas simples (') dentro do HTML
                - Para cada artigo importante: frequência, dificuldade, explicação, conexões, cite as jurisprudência e a doutrina que já foram cobradas mencionado o texto e a referência e pegadinhas
                - Use cores: #d32f2f (alertas), #1976d2 (conceitos), #388e3c (jurisprudência), #f57c00 (doutrina)
                - Use <br> entre seções de artigos
                - Emojis moderados (2-3 por seção)
                - Se artigo tiver letra (ex: 156-C), coloque apenas o número no array e explique a letra no HTML

                Aplique a regra de Pareto baseada nos últimos 5 anos de concursos.`;


            const anthropicResponse = await callAnthropicAPI(prompt);

            if (!anthropicResponse || !anthropicResponse.content || !anthropicResponse.content[0]) {
                return res.status(500).json({
                    error: 'Erro na resposta da IA',
                    message: 'A IA não retornou uma resposta válida'
                });
            }

            let responseText = anthropicResponse.content[0].text.trim();
            console.log('Resposta da IA (primeiros 500 chars):', responseText.substring(0, 500));

            // Lógica melhorada para extrair JSON
            let parsedResponse;
            try {
                // Tentar parsear diretamente primeiro
                parsedResponse = JSON.parse(responseText);
            } catch (directParseError) {
                console.log('Parse direto falhou, tentando extrair JSON...');
                
                try {
                    // Procurar por JSON na resposta usando regex mais robusta
                    const jsonRegexes = [
                        /\{[\s\S]*?\}/g, // JSON básico
                        /```json\s*(\{[\s\S]*?\})\s*```/g, // JSON em code block
                        /```\s*(\{[\s\S]*?\})\s*```/g, // JSON em code block sem "json"
                    ];

                    let jsonFound = false;
                    
                    for (const regex of jsonRegexes) {
                        const matches = [...responseText.matchAll(regex)];
                        
                        for (const match of matches) {
                            try {
                                const jsonStr = match[1] || match[0];
                                parsedResponse = JSON.parse(jsonStr);
                                jsonFound = true;
                                console.log('JSON encontrado e parseado com sucesso');
                                break;
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        if (jsonFound) break;
                    }

                    if (!jsonFound) {
                        throw new Error('Nenhum JSON válido encontrado na resposta');
                    }
                } catch (extractError) {
                    console.log('Erro ao extrair JSON:', extractError.message);
                    return res.status(500).json({
                        error: 'Erro ao processar resposta',
                        message: 'A IA não retornou um formato JSON válido',
                        debug: {
                            responseStart: responseText.substring(0, 300),
                            responseEnd: responseText.substring(Math.max(0, responseText.length - 300)),
                            parseError: extractError.message
                        }
                    });
                }
            }

            console.log('entrou 5 - JSON parseado:', Object.keys(parsedResponse));

            // Validação da estrutura da resposta
            if (!parsedResponse.artigos_importantes || !Array.isArray(parsedResponse.artigos_importantes)) {
                return res.status(500).json({
                    error: 'Resposta inválida',
                    message: 'Lista de artigos importantes não encontrada ou inválida',
                    debug: parsedResponse
                });
            }

            if (parsedResponse.artigos_importantes.length === 0) {
                return res.status(500).json({
                    error: 'Resposta inválida',
                    message: 'Lista de artigos importantes está vazia'
                });
            }


            if (!parsedResponse.explicacao_html || parsedResponse.explicacao_html.trim().length === 0) {
                return res.status(500).json({
                    error: 'Resposta inválida',
                    message: 'Explicação HTML não encontrada ou vazia'
                });
            }

            // Atualizar o total de artigos se não estiver correto
            if (parsedResponse.total_artigos_identificados !== parsedResponse.artigos_importantes.length) {
                parsedResponse.total_artigos_identificados = parsedResponse.artigos_importantes.length;
            }

            // Indexar no Elasticsearch se os IDs foram fornecidos
            if (id_origin_law) {
                try {
                    await indexNotasElastic(id_origin_law, id_law, parsedResponse.artigos_importantes, parsedResponse.explicacao_html, disciplina, banca, area, cargo, es);
                    console.log('Indexado no Elasticsearch com sucesso');
                } catch (elasticError) {
                    console.error('Erro ao indexar no Elasticsearch:', elasticError);
                    // Não retornar erro aqui, apenas logar
                }
            }

            // Resposta de sucesso
            res.status(200).json({
                success: true,
                data: {
                    lei: lei,
                    banca_analisada: parsedResponse.banca_analisada || (banca || 'Todas as principais'),
                    disciplina_analisada: parsedResponse.disciplina_analisada || (disciplina || 'Multidisciplinar'),
                    area_analisada: parsedResponse.area_analisada || (area || 'Todas as principais'),
                    cargo_analisado: parsedResponse.cargo_analisado || (cargo || 'Todos os principais'),
                    artigos_importantes: parsedResponse.artigos_importantes,
                    total_artigos_identificados: parsedResponse.artigos_importantes.length,
                    explicacao_html: parsedResponse.explicacao_html,
                    timestamp: new Date().toISOString(),
                    analise_periodo: 'Últimos 5 anos (2019-2024)',
                    typeresposta: 'analiselaw'
                }
            });

        } catch (error) {
            console.error('Erro ao processar análise de artigos:', error);
            
            // Tratamento de diferentes tipos de erro
            if (error.response) {
                // Erro da API da Anthropic
                return res.status(error.response.status || 500).json({
                    error: 'Erro na API da Anthropic',
                    message: error.response.data?.error?.message || 'Erro desconhecido na IA',
                    details: error.response.status === 429 ? 'Limite de taxa excedido. Tente novamente em alguns minutos.' : null
                });
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                // Erro de conexão
                return res.status(503).json({
                    error: 'Erro de conexão',
                    message: 'Não foi possível conectar com a API da Anthropic'
                });
            } else {
                // Erro genérico
                return res.status(500).json({
                    error: 'Erro interno do servidor',
                    message: 'Erro inesperado ao processar a análise de artigos',
                    debug: error.message
                });
            }
        }
    });

    router.post('/gerar-tarefas', validateApiKey, async (req, res) => {
        try {
            const { planGeral, planning } = req.body;

            // Validação básica dos dados recebidos
            if (!planGeral || !planning || !planGeral.legislations || !planning.legislationHours) {
                return res.status(400).json({ 
                    error: 'Dados incompletos: planGeral e planning são obrigatórios' 
                });
            }

            console.log('📋 Dados recebidos:', {
                planGeral: {
                    area: planGeral.area,
                    targetExam: planGeral.targetExam,
                    examBoard: planGeral.examBoard,
                    legislationsCount: planGeral.legislations.length
                },
                planning: {
                    id: planning.id,
                    cycleType: planning.cycleType,
                    weeklyHours: planning.weeklyHours,
                    legislationHours: planning.legislationHours
                }
            });

            const prompt = `
                Você é um especialista em planejamento de estudos jurídicos para concursos e provas da oab. Analise os dados fornecidos e gere tarefas de estudo otimizadas.

                ## DADOS DO PLANO GERAL:
                - Área: ${planGeral.area}
                - Concurso: ${planGeral.targetExam}
                - Cargo: ${planGeral.targetPosition}  
                - Banca: ${planGeral.examBoard}
                - Período: ${planGeral.startDate} a ${planGeral.endDate}

                ## LEGISLAÇÕES PARA ESTUDO:
                ${planGeral.legislations.map(leg => `
                - ${leg.law.name}
                - Modalidade: ${leg.studyOption}
                - Prioridade: ${leg.prioridade}
                - Último artigo estudado: ${leg.lastArtStudy || 'Nenhum (iniciar do art. 1)'}
                - Artigos específicos: ${leg.listArts ? JSON.stringify(leg.listArts) : 'Todos'}
                - Artigos já estudados: ${leg.artsStudy ? JSON.stringify(leg.artsStudy) : 'Nenhum'}
                `).join('')}

                ## CONFIGURAÇÃO DO CICLO ATUAL:
                - Período: ${planning.startDate} a ${planning.endDate}
                - Tipo de ciclo: ${planning.cycleType}
                - Horas semanais: ${planning.weeklyHours}
                - Inclui finais de semana: ${planning.includeWeekends}
                - Distribuição de horas por legislação: ${JSON.stringify(planning.legislationHours)}

                ## INSTRUÇÕES PARA GERAÇÃO DE TAREFAS:

                ### 1. ESTRUTURA DE CADA TAREFA:
                \`\`\`json
                {
                "id": "timestamp_único",
                "type": "study", 
                "legislation": "nome_da_legislação",
                "description": "Descrição clara da tarefa (ex: 'Estudo dos artigos 1 a 4 da CF88 - Princípios Fundamentais')",
                "arts": [1, 2, 3, 4],
                "artRefs": [
                    {"art": 1, "ref": [5, 6, 37]},
                    {"art": 2, "ref": [1, 3, 5]},
                    {"art": 3, "ref": [1, 2, 4]},
                    {"art": 4, "ref": [2, 3, 6]}
                ],
                "estimatedHours": "45min",
                "status": "pending",
                "completedAt": null,
                "createdAt": "2025-08-28T00:00:00.000Z"
                "observacao": "Não foi possivel inserir nas tarefas os arts. pode nao haver tempo suficiente atribuido a legislacao"
                }
                \`\`\`

                ### 2. CRITÉRIOS PARA GERAÇÃO:

                **DURAÇÃO DAS TAREFAS:**
                - Cada tarefa: 30 minutos a 1 hora máximo
                - deve se considerar o tamanho texto dos artigos sugeridos e sua complexidade
                - caso o usuario indique os artigos em listArts e o tempo nao seja exequivel, limite apenas o que seja viavel no tempo
                - Justifique a questao do tempo nao exequivel no campo observação da ultima tarefa de cada legislacao, se for o caso.
                - Incluir tempo para: leitura + flashcards + questões + mapas mentais
                - Se legislação tem mais de 1h disponível, criar múltiplas tarefas

                **SELEÇÃO DE ARTIGOS POR MODALIDADE:**
                - **Integral**: Sequencial desde art. 1 ou desde lastArtStudy
                - **Indicar**: Apenas artigos em listArts  
                - **Seletivo**: Artigos mais cobrados em provas dos últimos 5 anos (${planGeral.examBoard} prioritária, principais bancas como alternativa, considerando  Área: ${planGeral.area ? planGeral.area : 'principais'}, Concurso: ${ planGeral.targetExam ? planGeral.targetExam : 'principais'  } e Cargo: ${planGeral.targetPosition ? planGeral.targetPosition : 'principais'}.

                **RELACIONAMENTOS ENTRE ARTIGOS:**
                - Para cada artigo estudado, identificar artigos relacionados da mesma lei
                - Base: questões de provas dos últimos 5 anos da banca ${planGeral.examBoard}
                - Se poucos dados da banca específica, usar FGV, CESPE, FCC, CESGRANRIO
                - Formato: {"art": X, "ref": [Y, Z]} ou {"art": X, "ref": []} se sem relações

                **DISTRIBUIÇÃO DE TEMPO:**
                Respeitar rigorosamente planning.legislationHours:
                ${Object.entries(planning.legislationHours).map(([lei, horas]) => 
                `- ${lei}: ${horas} hora(s)`
                ).join('\n')}

                ### 3. REGRAS DE EXCLUSÃO:
                - Excluir artigos já estudados (artsStudy)
                - Para modalidade "integral": continuar de lastArtStudy + 1
                - Para modalidade "indicar": apenas artigos de listArts

                ### 4. CRITÉRIOS DE QUALIDADE:
                - Agrupar artigos por tema/capítulo quando possível
                - Priorizar artigos mais cobrados em ${planGeral.targetExam}
                - Equilibrar quantidade de artigos com tempo disponível
                - Descrições claras e motivacionais

                ## RETORNO ESPERADO:
                Retorne APENAS um array JSON válido com as tarefas geradas, sem texto adicional:

                [
                {
                    // tarefa 1
                },
                {
                    // tarefa 2  
                }
                // ... demais tarefas
                ]

                IMPORTANTE: 
                - O JSON deve ser válido e parseável
                - Respeitar exatamente as horas definidas para cada legislação
                - Considerar que esta é uma semana de ${planning.weeklyHours} horas totais
                - Focar na qualidade sobre quantidade de artigos por tarefa
            `;

            let tasks;
            let usedFallback = false;

            // const anthropicResponse = await callAnthropicAPI(prompt);
            
            try {
                console.log('🤖 Tentando gerar tarefas com IA...');
                const anthropicResponse = await callAnthropicAPIRobust(prompt);

                tasks = parseAnthropicResponse(anthropicResponse);
                console.log('✅ Tarefas geradas com IA:', tasks.length);
                
            } catch (parseError) {
                console.error('❌ Erro na API da Anthropic:', apiError);
                console.log('🆘 Usando sistema de fallback...');
                
                // Usar sistema de fallback
                tasks = generateFallbackTasks(planGeral, planning);
                usedFallback = true;
            }

            // Estatísticas das tarefas geradas
            const stats = calculateTaskStats(tasks);

            // INDEXAR NO ELASTICSEARCH
            let indexar 
            try {
                if (typeof indexLegalTasks === 'function') {
                    indexar = await indexLegalTasks(planGeral, planning, tasks, stats, es);
                }
            } catch (esError) {
                console.error('⚠️ Erro na indexação (não fatal):', esError);
            }

            res.json({
                success: true,
                data: {
                    tasks,
                    plan: indexar,
                    planning: {
                        id: planning.id,
                        totalTasks: tasks.length,
                        period: `${planning.startDate} a ${planning.endDate}`,
                        weeklyHours: planning.weeklyHours
                    },
                    stats,
                    metadata: {
                        generatedWithAI: !usedFallback,
                        fallbackUsed: usedFallback,
                        timestamp: new Date().toISOString()
                    }
                }
            });

        } catch (error) {
            console.error('Erro na geração de tarefas:', error);
            res.status(500).json({ 
                error: 'Erro interno do servidor', 
                message: error.message
            });
        }
    });

  return router;
}