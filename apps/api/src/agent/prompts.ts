import { ChatPromptTemplate } from "@langchain/core/prompts";

const sharedSystemPrompt = `Voce apoia grupos de estudos espiritas online com linguagem simples, fraterna e educativa.
Seu papel e de apoio ao estudo, nunca de autoridade doutrinaria ou pessoal.
Use portugues do Brasil claro, curto e respeitoso.
Considere que a base atual trabalha principalmente com os estudos Emmanuel e A Caminho da Luz.
Nao invente citacoes, capitulos, referencias ou falas literais.
Nao copie obras completas nem trechos longos de livros.
Nao responda com tom de palavra final.
Se faltar contexto, diga isso com honestidade.
Se a pergunta tocar sofrimento intenso, luto, mediunidade pessoal, conflito familiar, Capela, racas adamicas, criticas religiosas ou futuro da humanidade, responda com prudencia e recomende revisao do professor.
Sempre deixe claro que o professor deve revisar o conteudo antes de publicar ou compartilhar.`;

export const buildLessonPlanPrompt = () =>
  ChatPromptTemplate.fromMessages([
    ["system", sharedSystemPrompt],
    [
      "human",
      `Monte um roteiro inicial e curto para uma aula online.

Grupo: {groupName}
Livro ou material base: {bookTitle}
Tema da semana: {theme}
Duracao estimada: {durationMinutes} minutos
Observacao do professor: {teacherNote}
Contexto adicional autorizado:
{context}

Entregue em texto simples, com estes blocos:
- Objetivo da aula
- Abertura
- Desenvolvimento em 3 passos
- Encerramento
- Lembrete final de revisao humana

Evite termos tecnicos, tom de autoridade e citacoes literais.`,
    ],
  ]);

export const buildReflectionQuestionsPrompt = () =>
  ChatPromptTemplate.fromMessages([
    ["system", sharedSystemPrompt],
    [
      "human",
      `Crie perguntas de reflexao para um encontro online.

Grupo: {groupName}
Livro ou material base: {bookTitle}
Tema da semana: {theme}
Contexto adicional autorizado:
{context}

Crie exatamente {questionCount} perguntas.
As perguntas devem ser curtas, acolhedoras e proprias para conversa em grupo.
Responda com uma pergunta por linha, sem explicacoes extras e sem respostas.`,
    ],
  ]);

export const buildSummarizePrompt = () =>
  ChatPromptTemplate.fromMessages([
    ["system", sharedSystemPrompt],
    [
      "human",
      `Resuma o texto enviado em portugues do Brasil, com clareza e simplicidade.

Grupo: {groupName}
Livro ou material base: {bookTitle}
Tema relacionado: {theme}
Texto autorizado para resumir:
{sourceText}

Entregue:
- um paragrafo curto com o resumo
- tres pontos principais em linhas separadas
- um lembrete final de revisao humana

Use apenas o texto enviado. Se faltar informacao, diga que o resumo e preliminar.`,
    ],
  ]);

export const buildAnswerPrompt = () =>
  ChatPromptTemplate.fromMessages([
    ["system", sharedSystemPrompt],
    [
      "human",
      `Responda a duvida abaixo com base apenas no contexto autorizado.

Grupo ou foco principal identificado: {groupName}
Livro ou material base mais provavel: {bookTitle}
Tema relacionado: {theme}
Pergunta do aluno: {question}
Palavras-chave da pergunta: {keywords}
Contexto autorizado:
{context}

Entregue:
- uma resposta curta, simples e respeitosa, com no maximo 4 frases
- sem tom de autoridade final
- com prudencia maior se o tema for sensivel ou pessoal
- uma orientacao para confirmar com o professor se houver qualquer incerteza

Se o contexto nao bastar, diga isso com honestidade. Nao invente citacoes.`,
    ],
  ]);
