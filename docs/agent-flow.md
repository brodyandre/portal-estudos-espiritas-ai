# Fluxo do Assistente

## Objetivo

Documentar o fluxo do endpoint `POST /api/agent/answer`, implementado com `LangGraph.js` para manter a resposta simples, rastreavel e robusta mesmo quando o modelo local nao estiver disponivel.

## Etapas do grafo

1. `receiveQuestion`
   Normaliza a pergunta, o tema e o contexto enviado pelo usuario.

2. `classifyStudyGroup`
   Confere o grupo selecionado e adiciona um alerta de revisao quando a pergunta menciona outro grupo.

3. `retrieveContext`
   Consulta os arquivos em `data/knowledge/*.md` com busca por palavras-chave e tambem aproveita o contexto enviado na propria pergunta.

4. `checkContext`
   Decide se o material reunido e suficiente para responder com mais seguranca.

5. `generateAnswer`
   Usa `Ollama` quando houver contexto suficiente. Se o modelo falhar, usa um fallback local claro. Se o contexto for curto demais, orienta levar a duvida ao professor.

6. `applySafetyReview`
   Revisa tamanho, clareza, lembrete de revisao humana e evita respostas que parecam citacoes longas.

7. `returnResponse`
   Entrega o objeto final no formato:

```json
{
  "answer": "Resposta curta e educativa.",
  "sources": [
    {
      "source": "conteudo autoral demonstrativo",
      "title": "Orientacoes do grupo",
      "score": 2.4
    }
  ],
  "needsTeacherReview": true,
  "safetyNotes": [
    "Conteudo de apoio gerado para revisao humana. Revise com cuidado antes de publicar ou compartilhar."
  ]
}
```

## Fontes e contexto

- `sources` pode trazer tanto arquivos recuperados do RAG simples quanto o item `contexto-informado-na-pergunta`.
- A busca local prioriza materiais do grupo selecionado e tambem aceita documentos gerais.
- O fluxo nao inventa citacoes e nao usa obras completas.

## Regras de seguranca

- Toda resposta e tratada como apoio inicial, nunca como palavra final.
- Quando faltar contexto, o endpoint orienta levar a duvida ao professor.
- Quando `Ollama` ou o proprio grafo falham, a API continua respondendo com fallback explicito.

## Arquivos principais

- `apps/api/src/agent/answer-graph.ts`
- `apps/api/src/agent/fallbacks.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/rag/retriever.ts`
