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

  return router;
}