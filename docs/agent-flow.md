# Fluxo do Assistente

## Objetivo

Documentar como o endpoint `POST /api/agent/answer` usa a base dos livros `Emmanuel` e `A Caminho da Luz` para responder com simplicidade, prudencia e possibilidade de revisao humana.

## Contexto usado pelo assistente

O assistente local trabalha principalmente com:

- `data/knowledge/emmanuel`
- `data/knowledge/a_caminho_da_luz`
- `data/knowledge/index.json`

Quando a pergunta informa um grupo, o fluxo prioriza esse contexto. Quando nao informa ou a duvida e ambigua, a busca pode considerar os dois livros.

## Etapas do fluxo

1. `receiveQuestion`
   Normaliza a pergunta recebida e o grupo informado pelo usuario.

2. `classifyStudyGroup`
   Tenta identificar se a pergunta se aproxima mais de `Emmanuel` ou `A Caminho da Luz`.

3. `retrieveContext`
   Consulta a base local e recupera os chunks mais aderentes por palavras-chave e similaridade simples.

4. `checkContext`
   Decide se o contexto encontrado e suficiente para responder com mais seguranca.

5. `generateAnswer`
   Usa o modelo local quando houver contexto adequado. Se o modelo falhar, usa fallback claro. Se o contexto for fraco, orienta levar a duvida ao professor.

6. `applySafetyReview`
   Revisa tom, tamanho, clareza, prudencia e necessidade de revisao humana.

7. `returnResponse`
   Entrega a resposta final para a UI.

## Formato da resposta

O endpoint retorna um objeto com:

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
      "source": "Emmanuel - Emmanuel - constancia no estudo",
      "title": "Emmanuel - constancia no estudo",
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

## Regras de resposta

- responder com linguagem curta, simples e respeitosa
- nao usar tom de autoridade final
- nao inventar citacoes
- nao copiar conteudo longo
- recomendar revisao humana quando o tema for sensivel
- orientar o aluno a conversar com o professor quando faltar contexto

## Temas sensiveis

O fluxo reforca prudencia em perguntas sobre:

- sofrimento intenso
- luto
- mediunidade pessoal
- conflito familiar
- Capela
- racas adamicas
- criticas religiosas
- futuro da humanidade

Nesses casos, a resposta deve ser ainda mais curta, cuidadosa e revisavel.

## Fallbacks

### Se o Ollama falhar

- a API continua respondendo com modo de contingencia
- a resposta deixa claro que precisa de revisao humana

### Se o contexto for insuficiente

- a resposta evita parecer definitiva
- o usuario recebe orientacao para levar a duvida ao professor

### Se a API nao estiver disponivel

- o frontend usa fallback local
- a mensagem demonstrativa informa que a resposta esta baseada nos materiais locais resumidos

## Como testar localmente

1. Suba a API:

```bash
npm run dev:api
```

2. Teste o endpoint:

```bash
curl -X POST http://localhost:3333/api/agent/answer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Como viver o Evangelho na pratica?",
    "group": "Emmanuel"
  }'
```

Outras perguntas uteis:

- `Como continuar estudando mesmo desanimado?`
- `A prece muda meus problemas?`
- `O que e Capela?`
- `Como entender racas adamicas com prudencia?`

## Relacao com o GitHub Pages

O GitHub Pages publica apenas o frontend. Isso significa:

- o site continua navegavel sem backend
- os materiais aparecem por fallback local
- a resposta completa do assistente depende da API local
- o carregamento real dos Markdown e o uso do agente rodam fora do GitHub Pages

## Arquivos principais

- `apps/api/src/agent/answer-graph.ts`
- `apps/api/src/agent/prompts.ts`
- `apps/api/src/agent/safety.ts`
- `apps/api/src/agent/fallbacks.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/rag/retriever.ts`
