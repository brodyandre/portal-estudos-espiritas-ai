# Setup

## Objetivo

Explicar a forma mais simples de rodar o projeto localmente, com e sem Ollama, sem depender de banco de dados.

## Pre-requisitos

- Node.js em versao LTS recente
- npm
- opcionalmente, um ambiente local com Ollama disponivel

## Estrutura de trabalho

O monorepo possui duas apps:

- `apps/web`: frontend React
- `apps/api`: backend Express

Os comandos abaixo devem ser executados na raiz do repositorio.

## Instalacao

```bash
npm install
```

## Variaveis de ambiente

O projeto inclui `.env.example` com os valores padrao:

```bash
NODE_ENV=development
PORT=3333
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
OLLAMA_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

Se quiser personalizar, crie um `.env` na raiz com base nesse arquivo.

## Rodando a stack completa

```bash
npm run dev
```

Esse comando sobe:

- frontend em `http://localhost:5173`
- API em `http://localhost:3333`

## Rodando apenas o frontend

```bash
npm run dev:web
```

Uso recomendado:

- validacao visual
- demo estatica
- desenvolvimento de interface

Mesmo sem a API, a interface continua funcional com mocks locais.

## Rodando apenas a API

```bash
npm run dev:api
```

Uso recomendado:

- testes de endpoints
- validacao do agente e do RAG simples
- integracao com frontend ja compilado ou executado em paralelo

## Uso sem Ollama

Este e o fluxo mais simples para comecar.

1. Rode `npm install`.
2. Rode `npm run dev`.
3. Acesse `http://localhost:5173`.

Comportamento esperado:

- o frontend usa a API local quando ela esta disponivel
- se a API falhar, o frontend cai para mocks locais
- se a API estiver ativa, mas o modelo local nao responder, os endpoints de assistencia usam fallback claro

Na pratica, isso significa que o projeto continua demonstravel mesmo sem modelo local.

## Uso com Ollama

Para demonstrar geracao local:

1. Garanta que o servico do Ollama esteja disponivel.
2. Verifique se `OLLAMA_BASE_URL` aponta para o endereco correto.
3. Verifique se `OLLAMA_MODEL` aponta para um modelo existente no seu ambiente.
4. Rode `npm run dev`.

Comportamento esperado:

- `POST /api/agent/answer` tenta responder com apoio do modelo local
- `POST /api/agent/lesson-plan` tenta gerar roteiro inicial
- `POST /api/agent/reflection-questions` tenta gerar perguntas iniciais
- `POST /api/agent/summarize` tenta gerar resumo inicial

Se o modelo nao estiver pronto, a API responde com conteudo de contingencia e informa isso na mensagem de retorno.

## Build e verificacoes

```bash
npm run build
npm run typecheck
npm run test
npm run rag:validate
```

O que cada comando faz:

- `build`: compila frontend e backend
- `typecheck`: valida TypeScript nas duas apps
- `test`: executa os testes atuais da API
- `rag:validate`: verifica se os Markdown de `data/knowledge` estao consistentes

## Preview do frontend compilado

```bash
npm run build:web
npm run preview
```

Uso recomendado:

- revisar a build estatica
- validar comportamento antes de publicar no GitHub Pages

## Solucao de problemas

### O frontend abriu, mas a API nao responde

Verifique:

- se `npm run dev` ou `npm run dev:api` esta rodando
- se a porta `3333` esta livre
- se `VITE_API_URL` nao foi configurada para outro endereco

Se nada disso resolver, o frontend ainda deve seguir no modo demonstrativo.

### O assistente nao respondeu com modelo local

Verifique:

- se o servico do Ollama esta ativo
- se `OLLAMA_BASE_URL` esta correto
- se `OLLAMA_MODEL` existe no ambiente local

Mesmo com falha, a API deve devolver fallback claro.

### O frontend no GitHub Pages nao consegue chamar a API

Isso e esperado quando a API nao esta publicada.

Opcoes:

- usar o frontend estatico com fallback local para portfolio
- rodar a API localmente durante uma demonstracao
- publicar uma API separada em outra etapa

## Scripts disponiveis hoje

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run build
npm run build:web
npm run build:api
npm run start
npm run preview
npm run test
npm run typecheck
npm run rag:validate
```

Observacao:

- ainda nao existe `npm run lint`
- ainda nao existe `npm run demo:seed`
