# Fluxo do Assistente

## Objetivo

Documentar o fluxo do endpoint `POST /api/agent/answer`, implementado com `LangGraph.js` para manter a resposta simples, rastreavel e robusta mesmo quando o modelo local nao estiver disponivel.

## Etapas do grafo

1. `receiveQuestion`
   Normaliza a pergunta, o tema e o contexto enviado pelo usuario.

2. `classifyStudyGroup`
   Tenta identificar se a pergunta conversa mais com Emmanuel ou A Caminho da Luz. Quando nao identifica com clareza, abre a busca para os dois grupos.

3. `retrieveContext`
   Consulta os arquivos em `data/knowledge/*.md` com busca por palavras-chave, considera o contexto enviado na propria pergunta e ajusta o foco do grupo quando os resultados apontam outro livro com mais clareza.

4. `checkContext`
   Decide se o material reunido e suficiente para responder com mais seguranca.

5. `generateAnswer`
   Usa `Ollama` quando houver contexto suficiente. Se o modelo falhar, usa um fallback local claro. Se o contexto for curto demais, orienta levar a duvida ao professor.

6. `applySafetyReview`
   Revisa tamanho, clareza, lembrete de revisao humana, evita respostas que parecam citacoes longas e adiciona maior prudencia para temas sensiveis.

7. `returnResponse`
   Entrega o objeto final no formato:

```json
{
  "answer": "Resposta curta e educativa.",
  "group": {
    "id": "emmanuel",
    "name": "Emmanuel",
    "bookTitle": "Emmanuel",
    "matchMode": "question_hint"
  },
  "sources": [
    {
      "source": "Emmanuel · Emmanuel - constancia no estudo",
      "title": "Orientacoes do grupo",
      "score": 2.4
    }
  ],
  "keywords": ["constancia", "estudo"],
  "needsTeacherReview": true,
  "safetyNotes": [
    "Conteudo de apoio gerado para revisao humana. Revise com cuidado antes de publicar ou compartilhar."
  ],
  "suggestedTeacherFollowUp": "Se quiser aprofundar, vale levar esta pergunta ao professor com o trecho que mais chamou sua atencao."
}
```

## Fontes e contexto

- `sources` pode trazer tanto arquivos recuperados do RAG simples quanto o item `contexto-informado-na-pergunta`.
- O campo `group` mostra o foco mais provavel da resposta e pode indicar busca ampliada nos dois livros.
- `keywords` resume pistas uteis para leitura, revisao e acompanhamento do professor.
- A busca local prioriza materiais do grupo mais provavel, mas tambem aceita documentos gerais e, quando necessario, faz busca ampliada.
- O fluxo nao inventa citacoes e nao usa obras completas.

## Regras de seguranca

- Toda resposta e tratada como apoio inicial, nunca como palavra final.
- Quando faltar contexto, o endpoint orienta levar a duvida ao professor.
- Perguntas sobre sofrimento intenso, luto, mediunidade pessoal, conflito familiar, Capela, racas adamicas, criticas religiosas ou futuro da humanidade ganham alerta extra de revisao humana.
- Quando `Ollama` ou o proprio grafo falham, a API continua respondendo com fallback explicito.

## Arquivos principais

- `apps/api/src/agent/answer-graph.ts`
- `apps/api/src/agent/fallbacks.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/rag/retriever.ts`
