# portal-estudos-espiritas-ai

[![Continuous Integration](https://github.com/brodyandre/portal-estudos-espiritas-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/brodyandre/portal-estudos-espiritas-ai/actions/workflows/ci.yml)

Aplicacao web demonstrativa para apoiar grupos de estudos espiritas online via Google Meet, com experiencia separada para aluno e professor, frontend publicavel no GitHub Pages e backend local com apoio opcional de Ollama.

Por responsabilidade editorial e direitos autorais, o projeto nao versiona os PDFs das obras. A base de conhecimento utiliza arquivos Markdown autorais, curtos e revisaveis.

## Objetivo

Entregar um portal gratuito, responsivo e mobile-first que ajude a organizar encontros online, materiais, resumos, duvidas e apoio de estudo sem substituir a orientacao humana do professor.

## Problema resolvido

Grupos de estudo online costumam espalhar informacoes entre links, mensagens, resumos e duvidas. Este projeto centraliza o essencial em uma interface simples:

- proxima aula e acesso ao Meet
- materiais de apoio por livro e grupo
- resumos e duvidas do aluno
- progresso demonstrativo
- rascunhos iniciais para apoio ao professor

## O que esta versao entrega

- Home com apresentacao do projeto e acesso rapido para Portal, Aluno e Professor
- Pagina `/portal` compartilhavel, sem login e pronta para GitHub Pages
- Paginas `/educacao-continuada`, `/inscricao` e `/divulgacao` para acolhimento e divulgacao de novos alunos
- Painel `/aluno` com proxima aula, materiais de apoio, assistente, duvidas, resumo e progresso
- Painel `/professor` com selecao de livro, base de apoio da aula, geracao de rascunhos, revisao e publicacao local
- Estrutura conceitual separada para experiencias `Publico`, `Aluno`, `Professor` e `Admin`
- Paginas de materiais com navegacao para os livros `Emmanuel` e `A Caminho da Luz`
- API local em Express com dados mockados, base de conhecimento em Markdown e respostas JSON padronizadas
- autenticação local simples com JWT para Admin, Professor e Aluno no ambiente privado
- troca obrigatória da senha temporária no primeiro acesso do aluno aprovado
- redefinição administrativa de senha por admin, com encerramento imediato das sessões anteriores
- proteção contra força bruta e excesso de tentativas em login, troca de senha e reset administrativo
- Integracao opcional com Ollama, com fallback claro quando o modelo nao estiver disponivel
- Funcionamento da interface mesmo com backend desligado, usando mocks e respostas demonstrativas no frontend

## Stack

- Frontend: React, TypeScript e Vite
- Backend: Node.js, TypeScript e Express
- Assistencia local: LangChain.js, LangGraph.js e Ollama
- Base de conhecimento: arquivos Markdown em `data/knowledge`
- Testes iniciais: Vitest e Supertest
- Publicacao estatica do frontend: GitHub Pages

## CI

O projeto possui uma pipeline de integração contínua no GitHub Actions para validar o monorepo sem depender de serviços externos.

Comandos executados pela pipeline:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `make pages-check`

Observações:

- a instalação usa `npm ci` na raiz, com cache do `package-lock.json`
- o Prisma Client é gerado apenas se o `postinstall` não o tiver deixado disponível
- os testes automatizados usam repositórios em memória e não dependem de PostgreSQL, Docker, Ollama ou `.env` real

## Arquitetura

O projeto usa um monorepo simples com duas aplicacoes:

- `apps/web`: interface React com `HashRouter`, design system proprio, servicos reutilizaveis e fallback local
- `apps/api`: API Express com modulos por dominio, agente local, RAG simples e endpoints da base de conhecimento
- `data/knowledge`: resumos autorais curtos usados como apoio de contexto

Resumo do fluxo:

```text
Frontend
  -> tenta consumir a API via VITE_API_URL ou http://localhost:3333
  -> se a API falhar, usa mocks locais e respostas demonstrativas

API
  -> serve estudos, materiais, resumos, duvidas, progresso e base de conhecimento
  -> carrega Markdown local e index.json
  -> recupera contexto por palavras-chave
  -> tenta usar Ollama para responder e gerar rascunhos
  -> se Ollama falhar, responde em modo de contingencia
```

Documentacao complementar:

- [docs/knowledge-base.md](docs/knowledge-base.md)
- [docs/rag.md](docs/rag.md)
- [docs/agent-flow.md](docs/agent-flow.md)
- [docs/admin-area.md](docs/admin-area.md)
- [docs/user-guide-student.md](docs/user-guide-student.md)
- [docs/user-guide-teacher.md](docs/user-guide-teacher.md)
- [docs/responsible-ai.md](docs/responsible-ai.md)
- [docs/free-deployment.md](docs/free-deployment.md)
- [docs/access-control.md](docs/access-control.md)
- [docs/api.md](docs/api.md)

## Base de conhecimento incluida

Livros disponiveis:

- `Emmanuel`
- `A Caminho da Luz`

Onde ficam os arquivos:

- `data/knowledge/emmanuel`
- `data/knowledge/a_caminho_da_luz`
- `data/knowledge/index.json`

O que essa base contem:

- arquivos curtos por tema, capitulo, FAQ, palavras-chave e visao geral
- metadados para busca simples
- indicacao de temas sensiveis e necessidade de revisao humana
- linguagem preparada para alunos e professores nao tecnicos

Como o assistente usa os materiais:

- a API carrega os Markdown e o indice local
- o RAG simples recupera os trechos mais uteis por palavras-chave
- o agente monta respostas curtas, educativas e revisaveis
- se a API ou o modelo local nao estiverem disponiveis, o frontend usa fallback com dados resumidos em `apps/web/src/mocks/knowledge.ts`

Exemplos de perguntas:

- `Como continuar estudando mesmo desanimado?`
- `O que significa esforco proprio?`
- `O livro A Caminho da Luz e historico ou espiritual?`
- `Como entender Capela com prudencia?`
- `Como viver o Evangelho na pratica?`

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
Makefile
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
npm run db:up
npm run db:down
npm run db:migrate
npm run db:seed
npm run db:studio
```

Para autenticação local, use também:

```bash
# acesse /login no frontend local
# credenciais demonstrativas:
# admin.demo@example.com / AdminDemo@123
# professor.demo@example.com / ProfessorDemo@123
# aluno.demo@example.com / AlunoDemo@123
```

Ao aprovar uma inscrição no ambiente local:

- o backend cria ou reativa o acesso do aluno no PostgreSQL
- a resposta retorna e-mail e senha temporária de forma segura
- o primeiro login do aluno redireciona para `/primeiro-acesso`
- a nova senha precisa ter 8 caracteres ou mais, com letra maiúscula, letra minúscula e número
- após a troca, `mustChangePassword` passa para `false` e o token anterior deixa de valer
- `passwordChangedAt` registra a última alteração de credencial, inclusive quando uma nova senha temporária é emitida
- `passwordHash` nunca é exposto
- o envio ao aluno continua manual no MVP

Na gestão administrativa local:

- apenas admin pode redefinir a senha de outro usuário
- a operação gera uma nova senha temporária forte
- sessões anteriores são invalidadas imediatamente
- `mustChangePassword` volta para `true`
- a senha temporária é exibida uma única vez e deve ser entregue por canal seguro

Proteção de tentativas no ambiente local:

- `POST /api/auth/login`: até 5 tentativas inválidas por IP + e-mail em 15 minutos
- `PATCH /api/auth/change-password`: até 5 tentativas inválidas por usuário em 15 minutos
- `POST /api/admin/users/:userId/reset-password`: até 10 redefinições por admin em 15 minutos
- o reset administrativo também limita repetições globais para o mesmo usuário-alvo, mesmo entre admins diferentes
- a API responde com `429`, código estável e `Retry-After`
- os contadores ficam apenas em memória e são perdidos ao reiniciar a API

Atalhos com Makefile:

```bash
make help
make install
make dev
make dev-web
make dev-api
make build
make test
make lint
make db-up
make db-down
make db-migrate
make db-seed
make db-studio
make pages-check
make docker-up
make docker-down
```

## Rodando localmente

Fluxo principal:

```bash
npm install
npm run dev
```

Servicos locais:

- frontend em `http://localhost:5173`
- API em `http://localhost:3333`
- PostgreSQL em `localhost:5435`

Para subir apenas a API:

```bash
npm run dev:api
```

Para subir apenas o banco local:

```bash
npm run db:up
```

## Como testar perguntas

Com a API local ativa, voce pode testar o endpoint do assistente:

```bash
curl -X POST http://localhost:3333/api/agent/answer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Como continuar estudando mesmo desanimado?",
    "group": "Emmanuel"
  }'
```

Outros exemplos uteis:

- `O que significa esforco proprio?`
- `O que e Capela?`
- `Como entender racas adamicas com prudencia?`
- `Como viver o Evangelho na pratica?`

## Frontend no GitHub Pages x backend local

O GitHub Pages publica apenas o frontend.

O que fica publicado:

- Home
- Portal
- entrada publica para QR Code e inscricao
- Painel do Aluno em modo demonstrativo
- Painel do Professor em modo demonstrativo
- rota `/#/admin` como visao administrativa do MVP
- paginas de materiais
- base de conhecimento autoral em formato resumido
- mocks nao sensiveis para grupos, materiais e respostas demonstrativas

O que continua local nesta fase:

- backend em Express
- PostgreSQL local via Docker Compose
- autenticação local por JWT
- revisao administrativa real em `/admin` e `/professor`
- endpoints da base de conhecimento
- assistente completo
- Ollama
- carregamento real dos arquivos Markdown pelo backend
- acesso privado real do aluno aprovado
- link real do Google Meet apenas para ambiente local autorizado

Na pratica:

- o site publicado continua navegavel e util sem backend
- a experiencia completa de respostas e busca na base roda melhor com a API local
- a versao publica nao mostra link real do Meet nem dados reais sensiveis

## PostgreSQL local

O backend passa a oferecer persistencia local para inscricoes usando PostgreSQL e Prisma.

Nesta fase:

- o banco roda apenas na maquina local
- a porta usada no host e `5435`
- o GitHub Pages continua sem acesso ao banco
- a seed usa apenas dados demonstrativos e seguros

Documentacao complementar:

- [docs/local-postgres.md](docs/local-postgres.md)
- [docs/local-auth.md](docs/local-auth.md)

## Login local por perfil

O modo local agora permite login simples por perfil para:

- `Admin`
- `Professor`
- `Aluno`

Fluxo:

- abra `/login` no frontend local
- entre com um dos usuários demonstrativos da seed
- o backend devolve um token JWT local
- `/aluno`, `/professor` e `/admin` passam a respeitar esse login

No GitHub Pages:

- a mesma rota continua apenas como demonstração segura
- o login real não acontece sem backend
- a navegação pública continua disponível com fallback

## Limites do GitHub Pages

O GitHub Pages desta fase deve ser tratado como vitrine estatica e demonstrativa.

O que pode ser publicado:

- frontend estatico
- paginas publicas
- area de aluno em modo demonstrativo
- area de professor em modo demonstrativo
- area admin em modo demonstrativo
- base de conhecimento autoral e resumida
- mocks nao sensiveis

O que nao pode ser publicado:

- dados reais de alunos
- WhatsApps reais
- e-mails reais
- tokens
- senhas
- PDFs das obras
- links reais do Google Meet em paginas publicas
- qualquer segredo operacional

Na pratica, o frontend publicado pode mostrar estrutura, navegacao e dados de exemplo, mas nao deve ser tratado como ambiente seguro para operacao real.

## Evolução para produção real

Para sair do modo demonstrativo e chegar a uma operacao real, o projeto deve evoluir para:

- backend autenticado para aluno, professor e admin
- autorizacao por perfil e por recurso
- persistencia segura de usuarios, grupos, auditoria e configuracoes
- entrega do link real do Meet apenas pelo backend autorizado
- armazenamento de configuracoes sensiveis fora do frontend
- trilha de auditoria real vinda do backend
- hospedagem separada para API e servicos privados

Enquanto essa etapa nao chega, o GitHub Pages deve continuar apenas como interface publica e demonstrativa.

## Experiencias e rotas

O projeto passa a ser documentado em quatro experiencias:

### Publico

Rotas:

- `/`
- `/portal`
- `/educacao-continuada`
- `/inscricao`
- `/divulgacao`
- `/materiais`

### Aluno

Rotas:

- `/aluno`
- `/aluno/materiais`
- `/aluno/assistente`
- `/aluno/progresso`

### Professor

Rotas:

- `/professor`
- `/professor/interessados`
- `/professor/aulas`
- `/professor/revisao`

### Admin

Rotas:

- `/admin`
- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/grupos`
- `/admin/conteudos`
- `/admin/configuracoes`
- `/admin/auditoria`

Regras principais:

- visitante nao ve link do Meet
- aluno aprovado ve link do Meet e materiais
- professor aprova alunos e revisa conteudos
- admin gerencia usuarios, grupos, configuracoes e auditoria
- no frontend publicado, essas regras ainda sao apenas demonstrativas
- seguranca real depende de backend autenticado em evolucao futura

## Modos da aplicacao

O frontend agora trabalha com dois modos centrais:

- `demo`: padrao do GitHub Pages, sem dados reais, sem Meet real e com avisos demonstrativos
- `local`: usado na maquina autorizada, com API local, revisao de interessados e acesso privado do aluno

Variaveis de ambiente do frontend:

```bash
VITE_APP_MODE=local
VITE_API_URL=http://localhost:3333
VITE_SHOW_REAL_MEET_LINK=true
VITE_ENABLE_ADMIN_FEATURES=true
VITE_ENABLE_TEACHER_FEATURES=true
```

Arquivo central:

- `apps/web/src/config/appMode.ts`

## Fluxo de entrada de novos alunos

Nesta fase, o projeto usa um fluxo simples para receber novos participantes sem expor o Google Meet publicamente.

Como funciona:

1. o novo aluno escaneia o QR Code do cartaz
2. o QR Code aponta para `/#/educacao-continuada`
3. o visitante conhece os grupos e segue para `/#/inscricao`
4. o cadastro coleta apenas dados minimos de contato e interesse
5. o professor revisa a solicitacao no painel
6. o aluno aprovado acessa a area do aluno e o link da aula

Regras importantes:

- o Google Meet nao deve ser exposto publicamente
- o QR Code deve apontar para `/educacao-continuada`
- professores revisam as solicitacoes antes de liberar o encontro
- temas sensiveis continuam exigindo revisao humana
- o MVP usa controle simples de acesso no frontend
- autenticacao real e melhoria futura

Exemplo de fluxo:

- novo aluno escaneia o QR Code
- preenche a inscricao
- professor aprova
- aluno acessa materiais e link da aula

No ambiente local/private:

- `PATCH /api/enrollments/:id/status` pode criar ou reativar o acesso do aluno
- o painel do professor mostra o e-mail e a senha temporária apenas após a aprovação
- a mensagem para o aluno continua sendo copiada e enviada manualmente

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

Padroes atuais em `.env.example`:

```bash
PORT=3333
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
VITE_API_URL=http://localhost:3333
OLLAMA_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://127.0.0.1:11434
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
- o Ollama deve rodar separado

## GitHub Pages

Para validar localmente a configuracao usada no workflow:

```bash
make pages-check
```

Caracteristicas da publicacao:

- nao usa backend
- nao usa Ollama
- nao depende de secrets
- publica apenas artefatos estaticos do frontend

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

## Screenshots placeholders

- Home: inserir captura de `/#/`
- Portal: inserir captura de `/#/portal`
- Aluno: inserir captura de `/#/aluno`
- Professor: inserir captura de `/#/professor`
- Materiais: inserir captura de `/#/materiais`

## Proximos passos

- ampliar a base de conhecimento com novos resumos autorais curtos
- adicionar mais testes para frontend, RAG e agente
- publicar uma API de demonstracao separada do ambiente local
- melhorar rastreio de temas sensiveis e revisao humana
- evoluir persistencia e autenticacao se o projeto sair do modo portfolio

## Direitos autorais

- o projeto deve usar apenas conteudo demonstrativo, autoral ou autorizado
- os PDFs das obras nao devem ser versionados
- nao devem ser copiados capitulos completos nem trechos longos
- os arquivos em `data/knowledge` devem permanecer curtos, revisaveis e editoriais

## Revisao humana

- o assistente de estudo nao substitui professores
- toda resposta deve poder ser revisada, corrigida ou recusada por uma pessoa
- temas sensiveis devem recomendar conversa com o professor
- no painel do professor, o conteudo gerado nasce como rascunho

## Uso responsavel

- nao tratar a interface como fonte de autoridade final
- nao publicar texto gerado sem leitura humana
- nao usar o assistente para inventar citacoes
- nao usar a base para redistribuir conteudo protegido

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
