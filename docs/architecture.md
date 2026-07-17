# Architecture

## Objetivo

Documentar como o projeto foi organizado para entregar uma demo funcional, portavel e facil de manter, com frontend estatico, backend local e assistencia opcional por modelo local.

## Principios

- mobile-first de verdade, com largura minima de 360px
- conteudo simples, educativo e revisavel
- desacoplamento entre frontend e backend
- funcionamento demonstrativo do frontend mesmo sem API
- funcionamento da interface mesmo quando a API falha
- assistencia como apoio, nunca como substituicao do professor

## Visao geral

```text
apps/web
  -> paginas Home, Portal, Aluno e Professor
  -> servicos HTTP com fallback para mocks
  -> build estatico compativel com GitHub Pages

apps/api
  -> endpoints REST para estudos, materiais, resumos, duvidas, progresso e administracao
  -> autenticacao local, sessoes e controle de papeis
  -> persistencia local em PostgreSQL para fluxos administrativos
  -> endpoints de assistencia para aluno e professor
  -> recuperacao de contexto por corpus governado em Markdown local
  -> integracao opcional com Ollama

data/knowledge
  -> documentos Markdown demonstrativos e autorizados
  -> armazenamento fisico governado do RAG
```

## Modos de execucao

### 1. Frontend sozinho

Melhor para portfolio publico e deploy estatico.

- o frontend tenta chamar a API local
- quando a API nao responde, a camada de servicos usa mocks locais
- a navegacao e o conteudo principal continuam funcionando

### 2. Frontend + API local

Melhor para demonstrar integracao ponta a ponta.

- o frontend consome `http://localhost:3333` por padrao
- a API responde em JSON padronizado
- fluxos administrativos autenticados usam persistencia local quando configurados

### 3. Frontend + API local + Ollama

Melhor para demonstrar geracao assistida local.

- a API tenta usar Ollama para responder ao aluno e gerar rascunhos do professor
- se Ollama nao estiver disponivel, a API devolve resposta em modo de contingencia
- a UX continua clara e sem travar o fluxo principal

## Arquitetura do frontend

### Estrutura

```text
apps/web/src/
  app/
  components/
    display/
    layout/
    ui/
  data/
  mocks/
  pages/
  services/
  styles/
  App.tsx
  main.tsx
```

### Responsabilidades

- `App.tsx`: registra as rotas `/`, `/portal`, `/aluno` e `/professor`
- `components/layout`: shell da aplicacao, sidebar desktop, mobile header e drawer
- `components/ui`: design system base, sem biblioteca pesada
- `pages`: composicao de cada tela
- `services`: acesso a API, tratamento de erro amigavel e fallback para mocks
- `mocks`: dados locais usados quando a API esta offline
- `styles`: tokens visuais e regras globais responsivas

### Decisoes importantes do frontend

- uso de `BrowserRouter` com `basename` derivado do `BASE_URL`; o GitHub Pages permanece como preview estatico em subpath com `404.html` espelhando o `index.html`
- `base: "./"` no Vite para build estatico mais simples
- camada de servicos centralizada para evitar duplicacao de fetch
- mensagens amigaveis quando o sistema cai para modo demonstrativo
- ordem de prioridade do mobile pensada para aula, Meet, duvidas, materiais e progresso

## Arquitetura do backend

### Estrutura

```text
apps/api/src/
  agent/
  config/
  data/
  lib/
  middleware/
  modules/
    agent/
    materials/
    progress/
    questions/
    studies/
    summaries/
    auth/
    admin/
  rag/
  routes/
  app.ts
  server.ts
```

### Responsabilidades

- `app.ts`: configura Express, trust proxy, request ID, logger, headers, CORS, JSON e middleware de erro
- `routes/`: registra `/health`, `/ready` e `/api`
- `modules/`: organiza endpoints por dominio, incluindo autenticacao e administracao
- `data/`: guarda dados demonstrativos usados por fluxos ainda nao persistidos
- `agent/`: prompts, seguranca, fallback, cliente do modelo e fluxo de resposta
- `rag/`: leitura governada dos Markdown, quebra em chunks e busca por palavras-chave
- `lib/`: respostas padronizadas, `AppError` e helpers assincronos

## Endpoints principais

- `GET /health`
- `GET /ready`
- `GET /api/studies`
- `GET /api/studies/:slug`
- `GET /api/summaries`
- `GET /api/questions`
- `POST /api/questions`
- `GET /api/materials`
- `GET /api/progress`
- `POST /api/agent/lesson-plan`
- `POST /api/agent/reflection-questions`
- `POST /api/agent/summarize`
- `POST /api/agent/answer`
- `POST /api/auth/login`
- `GET /api/admin/users`
- `GET /api/admin/knowledge/books`
- `GET /api/admin/knowledge/documents`

## Fontes de dados

### Dados demonstrativos e persistencia

- alguns fluxos publicos e demonstrativos ainda vivem em arquivos TypeScript ou mocks do frontend
- autenticacao local, usuarios, sessoes, convites, encontros e catalogo editorial usam PostgreSQL no modo local
- a area `/admin/conteudos` usa a API persistente para administrar o catalogo editorial
- o objetivo e manter a demo portavel sem esconder os contratos reais de administracao

### Base de conhecimento local

- arquivos Markdown em `data/knowledge`
- conteudo curto, demonstrativo e autorizado
- catalogo editorial persistente referencia esses arquivos por `filePath`
- o catalogo editorial e a autoridade de inclusao dos fluxos publicos
- o manifesto seguro inclui apenas livros ativos e documentos aprovados
- o corpus governado calcula identidade composta com `manifestFingerprint` editorial e `corpusFingerprint` fisico
- o cache do corpus e do retriever e local ao processo e valido apenas enquanto a identidade composta nao muda
- o estado operacional do corpus tambem e local ao processo, acoplado ao servico do corpus e consultavel por `GET /api/admin/knowledge/corpus/status`
- esse diagnostico mantem identidade e contagens associadas atomicamente ao ultimo snapshot publicado com sucesso
- a consulta administrativa de status le somente memoria, sem banco, filesystem, auditoria ou reconstrucao do corpus
- a reconstrucao administrativa explicita vive em `POST /api/admin/knowledge/corpus/rebuild`, exige admin, body ausente ou `{}`, rejeita query e executa rebuild fisico sincrono do catalogo governado
- o rebuild administrativo usa lock em memoria por processo, rate limit dedicado por administrador e auditoria persistente em `AuditLog`; nao ha fila, worker, job persistido, Redis ou lock distribuido
- o rebuild publica somente snapshot atomico; o retriever continua lazy e e reconstruido no proximo acesso quando `manifestFingerprint` ou `corpusFingerprint` muda
- arquivos aprovados ausentes, vazios, invalidos ou inconsistentes fazem os fluxos publicos falharem fechado, sem fallback para o loader legado

### Estado local do navegador

- o painel do professor salva rascunhos e aprovacao no `localStorage`
- isso permite simular continuidade sem backend de persistencia

## Fluxo do aluno

```text
Aluno abre /aluno
  -> frontend carrega grupos, resumos, materiais, duvidas e progresso
  -> se API falhar, usa mocks locais
  -> ao enviar pergunta:
       frontend chama /api/agent/answer
       API tenta recuperar contexto no corpus governado
       API tenta usar Ollama
       se falhar, responde com fallback
```

## Fluxo do professor

```text
Professor abre /professor
  -> frontend carrega grupos, duvidas, materiais e resumos
  -> professor escolhe grupo, tema e Meet
  -> botoes chamam endpoints de rascunho
  -> resposta volta como previa editavel
  -> aprovacao, rascunho e publicacao ficam locais no navegador
```

## Fallbacks e resiliencia

- se a API estiver indisponivel, o frontend continua util com mocks
- se Ollama estiver indisponivel, a API responde com conteudo de contingencia
- se o corpus governado estiver invalido ou indisponivel, os endpoints publicos de conhecimento e resposta falham fechado
- `/health` permanece publico, barato e sem diagnostico do corpus governado
- `/ready` permanece publico, consulta apenas conectividade minima do PostgreSQL e estado operacional em memoria do corpus, sem construir snapshot
- `ready` e `empty` deixam a instancia pronta; `not_built` e `building` indicam degradacao com HTTP 200; `stale`, `invalid`, `unavailable` e falha de banco deixam a instancia unready com HTTP 503
- se o contexto estiver fraco, a resposta orienta consultar o professor
- o sistema evita travar a interface por dependencia de um servico unico

## Responsividade e acessibilidade

- desktop com sidebar azul persistente
- mobile com header e drawer
- grids viram coluna unica em telas pequenas
- foco visivel, labels explicitos e botoes com area adequada para toque
- paginas organizadas por prioridade de uso em 360px

## Limites desta arquitetura

- autenticacao local ainda nao representa hardening completo de producao
- PostgreSQL local cobre os fluxos administrativos implementados, mas nem todos os dados demonstrativos migraram para persistencia
- sem sincronizacao real entre publicacao do professor e painel do aluno
- sem upload de arquivos
- sem pipeline de deploy automatico descrito nesta etapa
- sem cache distribuido ou coordenacao de identidade do corpus entre multiplas instancias
- locks, rate limits e estado operacional do corpus sao locais ao processo; em multiplas replicas futuras sera necessario redesenhar coordenacao, sem mudar o contrato HTTP
- o hardening de producao da API assume uma unica replica, `TRUST_PROXY_HOPS` numerico e CORS por lista explicita de origens
- o shutdown gracioso para de aceitar novas conexoes, aguarda o servidor HTTP encerrar e chama `prisma.$disconnect()` antes de finalizar o processo
- o projeto pode usar dominio proprio no futuro, mas os contratos da API permanecem descritos por paths relativos e nao dependem de hostname fixo nesta etapa

Esses limites sao intencionais para manter a demo simples e legivel enquanto os contratos persistentes evoluem por entregas.

## Evolucao natural

- separar tipos compartilhados em pacote comum
- ampliar cobertura de testes
- evoluir observabilidade operacional do corpus governado
- evoluir a busca de palavras-chave para busca vetorial quando houver necessidade real
