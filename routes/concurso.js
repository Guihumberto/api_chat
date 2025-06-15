import { Router } from 'express';

export default function createConcursoRouter({ openai, es }) {
  const router = Router();

  router.post('/revisao', async (req, res) => {
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
                    content: 'Você é um profissional experiente em orientação para concursos públicos que cria revisões detalhadas de forma clara e objetiva.',
                },
                {
                    role: 'user',
                    content: `
                      Regras:
                    - Crie um resumo completo detalhado do texto com formatação intuitiva em html.
                    - Não inclua nenhuma explicação fora do html.
                    - Se necessário, divida o conteúdo internamente mas una tudo em um texto final formatado em html.
                    - Cite exemplos de questões recorrentes e suas respectivas respostas e justificativas.

                     Texto:
                     ${texto}`,
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

  router.post('/questoes', async (req, res) => {
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
                    content: 'Você é um profissional experiente em orientação para concursos públicos que gera, seleciona e busca questoes para revisões para provas de concursos públicos. Você é um especialista em questões de concursos públicos.',
                },
                {
                    role: 'user',
                    content: `
                      CONTEXTO:
                      ${texto}
                      
                      Instruções:
                      - busque ou gere 30 questões do tipo certo e errado com base no contexto acima que sejam recorrentes e mais relevantes em concursos públicos.
                      - Retorne a resposta **exclusivamente** como um **array JSON válido**.
                      - Cada objeto do array deve ter a seguinte estrutura:
                      {
                          "pergunta": "texto da pergunta",
                          "resposta": "verdadeiro ou falso",
                          "justificativa": "justificativa da pergunta esta certa ou errada, explicando o porquê",
                          "ano": 2025, 
                          "banca": "se for gerada por IA 'GERADA POR IA' caso contrario coloque o nome da banca. exemplo 'CESPE/CEBRASPE'", 
                          "concurso": "GERADO POR IA ou o nome do concurso. exemplo: 'POLICIA FEDERAL'", 
                          "cargo": "GERADA POR IA ou o nome do cargo. exemplo: 'PROCURADOR GERAL DO ESTADO'" 
                      }
                      - Não crie perguntas que mencione o dispositivo/artigo.
                      - Não adicione nenhum texto antes ou depois do Json, nem numeração ou rótulos. Apenas o array puro.
                      - Se necessário, divida o conteúdo internamente mas una tudo em um json final valido formatado
                      - Sua resposta **deve começar com \`[\` e terminar com \`]\`** e conter apenas JSON válido.
                    `
                },
            ],
        });

        const resumo = completion.choices[0].message.content;

        if (!resumo.trim().startsWith('[') || !resumo.trim().endsWith(']')) {
            throw new Error("Nenhum array JSON encontrado na resposta.");
        }

        let questoes;
        try {
            const arrayMatch = resumo.match(/\[[\s\S]*\]/);
            if (!arrayMatch) {
                throw new Error('Nenhum array JSON encontrado na resposta.');
            }

            questoes = JSON.parse(arrayMatch[0]);
        } catch (err) {
            console.error("Erro ao fazer parse do JSON da resposta da OpenAI:", err);
            console.error("Resposta recebida:", resumo);
            return res.status(500).json({ error: 'Erro ao interpretar JSON gerado pela IA.' });
        }

        return res.json({ questoes });

    } catch (error) {
        console.error('Erro ao chamar a API da OpenAI:', error);
        return res.status(500).json({ error: 'Erro ao gerar as questões.' });
    }
  });

  router.post('/flashcards', async (req, res) => {
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
                    content: 'Você é um profissional experiente em orientação para concursos públicos que gera, seleciona e busca questoes para revisões por meio de flashcards para provas de concursos públicos.',
                },
                {
                    role: 'user',
                    content: `
                      CONTEXTO:
                      ${texto}
                      
                      Instruções:
                      - gere 50 questões do tipo certo e errado com base no contexto acima que sejam recorrentes e mais relevantes em concursos públicos.
                      - Retorne a resposta **exclusivamente** como um **array JSON válido**.
                      - Cada objeto do array deve ter a seguinte estrutura:
                      {
                          "pergunta": "texto da pergunta",
                          "resposta": "responder e justiicar a pergunta, comentando o porquê",
                          "nivel": "classificar em facil, medio ou dificil (sem acentos)",
                      }
                      - Não crie perguntas que mencione o dispositivo/artigo.
                      - Não adicione nenhum texto antes ou depois do Json, nem numeração ou rótulos. Apenas o array puro.
                      - Se necessário, divida o conteúdo internamente mas una tudo em um json final valido formatado
                      - Sua resposta **deve começar com \`[\` e terminar com \`]\`** e conter apenas JSON válido.
                    `
                },
            ],
        });

        const resumo = completion.choices[0].message.content;

        if (!resumo.trim().startsWith('[') || !resumo.trim().endsWith(']')) {
            throw new Error("Nenhum array JSON encontrado na resposta.");
        }

        let flashcards;
        try {
            const arrayMatch = resumo.match(/\[[\s\S]*\]/);
            if (!arrayMatch) {
                throw new Error('Nenhum array JSON encontrado na resposta.');
            }

            flashcards = JSON.parse(arrayMatch[0]);
        } catch (err) {
            console.error("Erro ao fazer parse do JSON da resposta da OpenAI:", err);
            console.error("Resposta recebida:", resumo);
            return res.status(500).json({ error: 'Erro ao interpretar JSON gerado pela IA.' });
        }

        return res.json({ flashcards });

    } catch (error) {
        console.error('Erro ao chamar a API da OpenAI:', error);
        return res.status(500).json({ error: 'Erro ao gerar as questões.' });
    }
  });

  router.post('/jurisprudencia', async (req, res) => {
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
                    content: 'Você é um profissional experiente em orientação para concursos públicos que busca jurisprudencia paradigmáticas e sumulas para estudo para provas de concursos públicos.',
                },
                {
                    role: 'user',
                    content: `
                      CONTEXTO:
                      ${texto}
                      
                      Instruções:
                      - Busque todas as sumulas e jurisprudencia paradigmatica com base no contexto acima que sejam recorrentes e mais relevantes em concursos públicos.
                      - Retorne a resposta **exclusivamente** como um **array JSON válido**.
                      - Cada objeto do array deve ter a seguinte estrutura como exemplo:
                        {
                            "orgao": "STF (orgao: 'STJ, STF ou Outro)",
                            "title": "Uso de algemas e dignidade da pessoa humana",
                            "tese": "O uso de algemas em audiência sem justificativa viola direitos fundamentais.",
                            "texto": "O STF decidiu que o uso de algemas em réu durante audiência, sem justificativa concreta e prévia, configura constrangimento ilegal e afronta à dignidade da pessoa humana, conforme entendimento da Súmula Vinculante 11.",
                            "vinculante": true (se for sumula vinculante ou tiver repercussão geral),
                            "nivel": "muito, medio ou pouco (analise da recorrencia em provas)",
                            "acao": "HC 91952/SP",
                            "ministro": "Gilmar Mendes"
                        }
                      - Não adicione nenhum texto antes ou depois do Json, nem numeração ou rótulos. Apenas o array puro.
                      - Se necessário, divida o conteúdo internamente mas una tudo em um json final valido formatado
                      - Sua resposta **deve começar com \`[\` e terminar com \`]\`** e conter apenas JSON válido.
                      - caso nao encontre nenhuma jurisprudencia, retorne um array vazio
                    `
                },
            ],
        });

        const resumo = completion.choices[0].message.content;

        if (!resumo.trim().startsWith('[') || !resumo.trim().endsWith(']')) {
            throw new Error("Nenhum array JSON encontrado na resposta.");
        }

        let juris;
        try {
            const arrayMatch = resumo.match(/\[[\s\S]*\]/);
            if (!arrayMatch) {
                throw new Error('Nenhum array JSON encontrado na resposta.');
            }

            juris = JSON.parse(arrayMatch[0]);
        } catch (err) {
            console.error("Erro ao fazer parse do JSON da resposta da OpenAI:", err);
            console.error("Resposta recebida:", resumo);
            return res.status(500).json({ error: 'Erro ao interpretar JSON gerado pela IA.' });
        }

        return res.json({ juris });

    } catch (error) {
        console.error('Erro ao chamar a API da OpenAI:', error);
        return res.status(500).json({ error: 'Erro ao gerar as questões.' });
    }
  });

  return router;
}