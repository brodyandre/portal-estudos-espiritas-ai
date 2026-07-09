import { ChatPromptTemplate } from "@langchain/core/prompts";

const sharedSystemPrompt = `Voce apoia grupos de estudos espiritas online com linguagem simples, fraterna e educativa.
Seu papel e de apoio, nunca de autoridade doutrinaria.
Use portugues do Brasil claro e direto.
Nao invente citacoes, capitulos, referencias ou falas literais.
Nao copie obras completas nem trechos longos de livros.
Se faltar contexto, diga isso com honestidade.
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

Grupo: {groupName}
Livro ou material base: {bookTitle}
Tema relacionado: {theme}
Pergunta do aluno: {question}
Contexto autorizado:
{context}

Entregue:
- uma resposta curta e respeitosa
- uma orientacao para confirmar com o professor se houver qualquer incerteza

Se o contexto nao bastar, diga isso com honestidade. Nao invente citacoes.`,
    ],
  ]);
