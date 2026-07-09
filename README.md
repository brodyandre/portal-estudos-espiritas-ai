# portal-estudos-espiritas-ai

Aplicacao web demonstrativa para apoiar grupos de estudos espiritas online via Google Meet, com experiencia separada para aluno e professor, backend local em Node.js e uso opcional de Ollama para respostas e rascunhos iniciais.

## Objetivo

Entregar um portal gratuito, responsivo e mobile-first que ajude a organizar encontros online, materiais, resumos, duvidas e apoio de estudo sem substituir a orientacao humana do professor.

## Problema resolvido

Grupos de estudo online costumam espalhar informacoes entre links, mensagens, resumos e duvidas soltas. Este projeto centraliza o essencial em uma interface simples:

- proxima aula e acesso ao Meet
- materiais e resumos da semana
- duvidas do aluno
- progresso demonstrativo
- rascunhos iniciais para apoio ao professor

## O que esta versao entrega

- Home com apresentacao do projeto e acesso rapido para Portal, Aluno e Professor
- Pagina `/portal` compartilhavel, sem login e pronta para GitHub Pages
- Painel `/aluno` com proxima aula, assistente de estudo, materiais, resumo, duvidas e progresso
- Painel `/professor` com fluxo de preparacao da aula, geracao de rascunhos, revisao e publicacao local
- API local em Express com dados mockados e respostas JSON padronizadas
- Base de conhecimento local em Markdown para recuperacao simples de contexto
- Integracao opcional com Ollama, com fallback claro quando o modelo nao estiver disponivel
- Funcionamento da interface mesmo com backend desligado, usando mocks locais no frontend

## Stack

- Frontend: React, TypeScript e Vite
- Backend: Node.js, TypeScript e Express
- Assistencia local: LangChain.js, LangGraph.js e Ollama
- Base de conhecimento inicial: arquivos Markdown em `data/knowledge`
- Testes iniciais da API: Vitest e Supertest
- Publicacao estatica do frontend: GitHub Pages

## Arquitetura

O projeto usa monorepo simples com duas aplicacoes:

- `apps/web`: interface React com `HashRouter`, design system proprio e camada de servicos com fallback para mocks
- `apps/api`: API Express com modulos por dominio, agente local, carga de documentos Markdown e busca simples por palavras-chave
- `data/knowledge`: conteudo demonstrativo e autorizado para apoio ao assistente

Resumo do fluxo:

```text
Frontend
  -> tenta consumir API via VITE_API_URL ou http://localhost:3333
  -> se a API falhar, usa mocks locais

API
  -> serve estudos, materiais, resumos, duvidas e progresso
  -> usa dados mockados sem banco
  -> consulta Markdown local para recuperar contexto
  -> tenta usar Ollama para gerar rascunhos e respostas
  -> se Ollama falhar, responde com modo de contingencia
```

Documentacao complementar:

- [docs/architecture.md](docs/architecture.md)
- [docs/setup.md](docs/setup.md)
- [docs/user-guide-student.md](docs/user-guide-student.md)
- [docs/user-guide-teacher.md](docs/user-guide-teacher.md)
- [docs/responsible-ai.md](docs/responsible-ai.md)
- [docs/free-deployment.md](docs/free-deployment.md)
- [docs/api.md](docs/api.md)
- [docs/rag.md](docs/rag.md)
- [docs/agent-flow.md](docs/agent-flow.md)

## Estrutura do repositorio

```text
apps/
  api/
    src/
  web/
    src/
data/
  knowledge/
docs/
CODEX_CONTEXT.md
package.json
```

## Comandos locais

Na raiz do projeto:

```bash
npm install
npm run dev
npm run dev:web
npm run dev:api
npm run build
npm run build:web
npm run build:api
npm run preview
npm run test
npm run typecheck
npm run rag:validate
```

Observacao:

- nesta versao ainda nao existe script dedicado de `lint`
- nesta versao ainda nao existe script dedicado de `demo:seed`

## Rodando localmente

Fluxo principal:

```bash
npm install
npm run dev
```

Servicos locais:

- frontend em `http://localhost:5173`
- API em `http://localhost:3333`

Atalhos uteis:

```bash
make help
make dev
make dev-web
make dev-api
make build
make test
make lint
```

## Docker

Para subir frontend e API em containers:

```bash
docker compose up --build
```

Servicos publicados:

- frontend em `http://localhost:3000`
- API em `http://localhost:4000`

Para encerrar os containers:

```bash
docker compose down
```

Observacoes importantes:

- o `docker-compose.yml` nao inclui banco
- o `docker-compose.yml` nao inclui Ollama
- o frontend e buildado com `VITE_API_URL=http://localhost:4000`
- o fluxo local com `npm run dev` continua igual, usando a API local em `http://localhost:3333`

## GitHub Pages

Nesta fase, o GitHub Pages publica apenas o frontend.

O que fica publicado:

- Home
- Portal
- Painel do Aluno
- Painel do Professor
- fallback para mocks quando nao houver backend

O que continua local:

- backend em Express
- endpoints da assistencia
- integracao com IA
- Ollama

## Testar a build do GitHub Pages

Para validar localmente a mesma configuracao usada no workflow:

```bash
make pages-check
```

Esse comando:

- ativa `GITHUB_PAGES=true`
- usa base compativel com o caminho do repositorio
- nao depende de `VITE_API_URL`
- garante que o frontend continue funcional em modo de fallback

## Como publicar no GitHub Pages

1. Mantenha o workflow em `.github/workflows/pages.yml`.
2. Garanta que o repositorio tenha o GitHub Pages configurado para usar `GitHub Actions`.
3. Envie as mudancas para a branch `main`.
4. O workflow vai buildar `apps/web` e publicar `apps/web/dist`.

Caracteristicas da publicacao:

- nao usa backend
- nao usa Ollama
- nao depende de secrets
- publica apenas artefatos estaticos do frontend

## Uso sem Ollama

Este e o caminho mais simples para portfolio, validacao de layout e demonstracao funcional.

1. Instale as dependencias com `npm install`.
2. Opcionalmente copie `.env.example` para `.env`.
3. Rode `npm run dev`.
4. Abra `http://localhost:5173`.

Comportamento esperado:

- se a API estiver ativa, a interface consome os endpoints locais
- se a API estiver desligada, o frontend continua funcionando com mocks locais
- se a API estiver ativa, mas o modelo local nao estiver disponivel, os endpoints de assistencia usam fallback claro

## Uso com Ollama

Use este modo quando quiser demonstrar o fluxo local de respostas e rascunhos apoiados por modelo.

1. Garanta que o servico do Ollama esteja disponivel no endereco definido em `OLLAMA_BASE_URL`.
2. Garanta que o modelo configurado em `OLLAMA_MODEL` exista no ambiente local.
3. Ajuste as variaveis em `.env` se necessario.
4. Rode `npm run dev`.
5. Use o painel do aluno ou do professor normalmente.

Se estiver usando Docker Compose:

- suba apenas `web` e `api` com `docker compose up --build`
- mantenha o Ollama rodando separado na maquina host
- por padrao, o compose aponta a API para `http://host.docker.internal:11434`
- se necessario, sobrescreva `OLLAMA_BASE_URL` e `OLLAMA_MODEL` no ambiente antes de subir os containers

Padroes atuais em `.env.example`:

```bash
PORT=3333
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
VITE_API_URL=http://localhost:3333
OLLAMA_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

## Scripts

- `npm run dev`: sobe frontend e backend juntos
- `npm run dev:web`: sobe apenas o frontend
- `npm run dev:api`: sobe apenas a API
- `npm run build`: compila frontend e backend
- `npm run build:web`: valida TypeScript e gera o build do frontend
- `npm run build:api`: compila a API para `apps/api/dist`
- `npm run start`: inicia a API compilada
- `npm run preview`: abre a versao compilada do frontend
- `npm run test`: executa os testes atuais da API
- `npm run typecheck`: roda verificacao de tipos nas duas apps
- `npm run rag:validate`: valida os arquivos Markdown em `data/knowledge`

## Makefile

- `make help`: lista os comandos disponiveis
- `make install`: instala dependencias
- `make dev`: sobe frontend e API localmente
- `make dev-web`: sobe apenas o frontend
- `make dev-api`: sobe apenas a API
- `make build`: compila frontend e backend
- `make test`: roda os testes atuais
- `make lint`: roda as verificacoes estaticas atuais
- `make docker-up`: sobe os containers
- `make docker-down`: derruba os containers
- `make pages-check`: valida a build do GitHub Pages
- `make clean`: remove artefatos locais de build

## Screenshots placeholders

- Home: inserir captura de `/#/`
- Portal: inserir captura de `/#/portal`
- Aluno: inserir captura de `/#/aluno`
- Professor: inserir captura de `/#/professor`

## Proximos passos

- adicionar persistencia real para duvidas, materiais e progresso
- ampliar a cobertura de testes do frontend e dos fluxos de agente
- publicar uma API de demonstracao separada do ambiente local
- enriquecer a base de conhecimento demonstrativa com mais temas autorizados
- adicionar trilha de observabilidade simples para falhas e uso de fallback

## Direitos autorais

- o projeto deve usar apenas conteudo demonstrativo, autoral ou autorizado
- nao deve copiar livros reais nem obras completas
- resumos, perguntas e roteiros devem ser sinteses proprias e revisaveis
- os arquivos em `data/knowledge` foram pensados para demonstracao e nao para redistribuicao de conteudo protegido

## Revisao humana

- o assistente de estudo nao substitui professores
- toda resposta deve poder ser revisada, corrigida ou recusada por uma pessoa
- no painel do professor, o conteudo gerado nasce como rascunho e exige revisao antes de publicar
- no painel do aluno, a orientacao final continua sendo do grupo e do professor

## Uso responsavel

- nao tratar a interface como fonte de autoridade doutrinaria
- nao publicar texto gerado sem leitura humana
- nao usar o assistente para inventar citacoes ou reproduzir obras completas
- manter linguagem simples, respeitosa e educativa

Mais detalhes em [docs/responsible-ai.md](docs/responsible-ai.md).

## Portfolio e empregabilidade

Este projeto foi estruturado para servir bem como peca de portfolio tecnico, porque demonstra:

- React com TypeScript e design system proprio
- backend em Node.js com Express e contratos JSON padronizados
- experiencia mobile-first com acessibilidade e fallback de UX
- integracao opcional com modelo local
- recuperacao de contexto em Markdown sem dependencia de banco vetorial
- documentacao orientada a produto, demo e manutencao

O foco nao e vender promessas de IA, e sim mostrar capacidade de construir um produto claro, portavel e profissional com boas decisoes de engenharia.
