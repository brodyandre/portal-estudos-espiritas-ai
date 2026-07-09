# API

## Objetivo

API local em `Express + TypeScript` para servir dados demonstrativos do portal de estudos espiritas, sem banco de dados e com respostas JSON padronizadas.

## Estrutura

```text
apps/api/
  src/
    app.ts
    server.ts
    config/
    data/
    lib/
    middleware/
    modules/
    routes/
  test/
```

## Scripts

Na raiz do projeto:

```bash
npm install
npm run dev
npm run build
npm run start
npm run test
```

### Atalhos uteis

```bash
npm run dev:api
npm run build:api
npm run start:api
npm run test:api
npm run typecheck
```

## Configuracao

Variaveis opcionais:

```bash
PORT=3333
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
OLLAMA_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

### CORS

- A API aceita por padrao origens locais como `localhost` e `127.0.0.1`.
- O objetivo e permitir o frontend local durante o desenvolvimento.

## Formato de resposta

### Sucesso

```json
{
  "success": true,
  "message": "Grupos de estudo carregados com sucesso.",
  "data": [],
  "meta": {
    "count": 2
  }
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "INVALID_GROUP_ID",
    "message": "Informe um groupId valido."
  }
}
```

## Endpoints

### `GET /health`

Retorna o estado basico da API.

### `GET /api/studies`

Lista os grupos mockados com dados da proxima aula.

### `GET /api/studies/:slug`

Retorna um grupo especifico.

Slugs iniciais:

- `emmanuel`
- `a-caminho-da-luz`

### `GET /api/summaries`

Lista os resumos demonstrativos.

Query opcional:

- `groupId`

### `GET /api/questions`

Lista as duvidas demonstrativas.

Query opcionais:

- `groupId`
- `status`

### `POST /api/questions`

Cria uma nova duvida em memoria.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "lessonId": "lesson-emmanuel-2026-07-13",
  "authorName": "Maria",
  "question": "Como posso organizar melhor meu estudo na semana?",
  "visibility": "group"
}
```

Validacoes basicas:

- `groupId` obrigatorio e valido
- `lessonId` obrigatorio
- `authorName` com pelo menos 2 caracteres
- `question` com pelo menos 10 caracteres
- `visibility` deve ser `group` ou `teacher`

### `GET /api/materials`

Lista os materiais demonstrativos.

Query opcionais:

- `groupId`
- `type`

### `GET /api/progress`

Retorna progresso demonstrativo do aluno.

Query opcionais:

- `studentId`
- `groupId`

### `POST /api/agent/lesson-plan`

Gera um roteiro inicial para a aula.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "theme": "Constancia no estudo durante a semana",
  "teacherNote": "Abrir com acolhimento breve.",
  "context": "Usar apenas conteudo demonstrativo autorizado.",
  "durationMinutes": 60
}
```

### `POST /api/agent/reflection-questions`

Gera perguntas de reflexao em linguagem simples.

Body esperado:

```json
{
  "groupId": "a-caminho-da-luz",
  "theme": "Convivio fraterno e responsabilidade",
  "context": "Foco em participacao respeitosa.",
  "questionCount": 5
}
```

### `POST /api/agent/summarize`

Gera um resumo inicial com base apenas no texto enviado.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "theme": "Leitura da semana",
  "sourceText": "Texto demonstrativo autorizado para resumo."
}
```

### `POST /api/agent/answer`

Gera uma resposta inicial curta com `LangGraph.js`, combinando contexto enviado na pergunta com busca simples nos arquivos Markdown autorizados.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "question": "Como manter o estudo vivo durante a semana?",
  "context": "O grupo incentiva pequenos passos, leitura curta e duvidas honestas."
}
```

Resposta esperada:

```json
{
  "success": true,
  "message": "Resposta inicial gerada com sucesso.",
  "data": {
    "answer": "Resposta curta e revisavel.",
    "sources": [
      {
        "source": "contexto-informado-na-pergunta",
        "title": "Contexto informado na pergunta",
        "score": 1
      },
      {
        "source": "conteudo autoral demonstrativo",
        "title": "Orientacoes do grupo",
        "score": 2.4
      }
    ],
    "needsTeacherReview": true,
    "safetyNotes": [
      "Conteudo de apoio gerado para revisao humana. Revise com cuidado antes de publicar ou compartilhar."
    ],
    "provider": "ollama",
    "usedFallback": false
  },
  "meta": {
    "provider": "ollama",
    "usedFallback": false
  }
}
```

Observacoes:

- O fluxo segue as etapas `receiveQuestion -> classifyStudyGroup -> retrieveContext -> checkContext -> generateAnswer -> applySafetyReview -> returnResponse`.
- Se o contexto ainda for insuficiente, a resposta orienta levar a duvida ao professor.
- A lista `sources` pode incluir o contexto enviado pelo proprio usuario, alem dos arquivos recuperados em `data/knowledge`.

### Fallback do modelo local

- Se o Ollama estiver indisponivel, a API responde com `success: true`, mas marca `usedFallback: true`.
- O campo `fallbackReason` explica por que o modo de contingencia foi usado.
- Toda resposta traz lembrete de revisao humana, sem autoridade doutrinaria e sem citacoes inventadas.

## Testes

Testes basicos implementados:

- `GET /health`
- `GET /api/studies`
- `POST /api/agent/lesson-plan`
- `POST /api/agent/answer`

## Observacoes

- Os dados usam apenas mocks locais em `apps/api/src/data`.
- O endpoint `POST /api/questions` grava em memoria apenas durante a execucao do processo.
- Os endpoints em `/api/agent/*` usam `LangChain.js + Ollama` quando o modelo local estiver disponivel.
- O endpoint `POST /api/agent/answer` usa `LangGraph.js` para orquestrar pergunta, classificacao do grupo, busca local e revisao de seguranca.
- Quando o modelo local nao responde, a API usa um fallback simples e explicito para a demonstracao continuar.
- Nao ha banco, autenticacao ou persistencia nesta etapa.
