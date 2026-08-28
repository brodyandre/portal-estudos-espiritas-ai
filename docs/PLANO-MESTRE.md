# Plano Mestre

## Estado

Producao operacional por superficie nas revisoes conhecidas abaixo.

Estado Git esperado: branch oficial `main`, `HEAD`/`main`/`origin/main` sincronizados, ahead/behind `0 0` e workspace limpo. O SHA efetivo da `main` deve ser verificado operacionalmente via Git no inicio de cada checkpoint.

Web producao: `7818eabc81bf0152ec109468a79422e85783893a`.

API producao: `47917158545338cf442f97ebe8b3a4aee2feed86`.

A Web oficial esta publicada e validada em `7818eabc81bf0152ec109468a79422e85783893a`, deploy Render `dep-da4poe3l550s738kmti0`. A API permanece no runtime conhecido `47917158545338cf442f97ebe8b3a4aee2feed86`, deploy Render `dep-da4ooms9v7es738rb7n0`. Essa diferenca por superficie nao representa, por si so, drift indevido nem exige alinhamento numerico entre Web e API.

MULTIGROUP-001D esta aprovado e o rollout controlado de producao foi concluido. O estado operacional conhecido inclui `Auto-Deploy = Off/no` para Web e API, conforme observacao do Render Dashboard, sem tratar isso como decisao arquitetural imutavel.

Web:

- `https://portal-educacao-continuada.com.br`

API:

- `https://api.portal-educacao-continuada.com.br`

Estado operacional oficial previamente validado:

- Web oficial live em `7818eabc81bf0152ec109468a79422e85783893a`, com smoke read-only em `/`, `/portal`, `/materiais` e `/login`
- API `/health = OK`
- API `/version = 47917158545338cf442f97ebe8b3a4aee2feed86`
- API `/ready = ready`
- API `database = ok`
- API `corpus = ready`
- API `/api/studies` DB-backed com `emmanuel` e `a-caminho-da-luz`; campos operacionais `meetingDay`, `meetingTime`, `participantCount`, `meetUrl`, `description` e `nextLesson` atualmente `null`
- Groq operacional como provider principal
- fallback LLM preservado
- Resend operacional como provider SMTP transacional inicial
- recuperacao de senha validada em producao por smoke real controlado
- frontend de producao sem credenciais demonstrativas ou copy local nas telas de autenticacao
- Home de producao consumindo `/api/studies` via `listStudies()`, sem 88/62, agenda demo, datas demo ou Meet demo apos PR #67 e redeploy corretivo
- API `/api/knowledge/groups` com Emmanuel `fileCount=1` e A Caminho da Luz `fileCount=1`
- corpus governado `ready` com 2 sources, 2 documentos e 11 chunks apos CORPUS-COVERAGE-001B
- e-mails transacionais alinhados a identidade publica Portal de Educação Continuada e timezone America/Sao_Paulo
- metadata publica da Web oficial alinhada a identidade publica Portal de Educação Continuada

## Capacidades Concluidas

- Monorepo com API Express/TypeScript e Web React/Vite.
- CI com typecheck, testes, build e verificacao de Pages.
- Publicacao estatica do frontend em modo demonstrativo.
- Artefatos de container para API e Web.
- Autenticacao local com JWT, sessoes persistidas e papeis.
- Administracao de usuarios, status, grupos, convites e encontros.
- Grupos de estudo, grupos canonicos produtivos e encontros autenticados.
- Vinculo persistente multi-grupo para professores via `TeacherStudyGroup`, com PK composta `userId/groupId`.
- BookAccess privado em `GET /api/me/book-access`, com escopo de aluno por grupo persistido e escopo de professor por `TeacherStudyGroup`.
- Catalogo editorial persistido para livros e documentos.
- Relacao governada opcional `StudyGroup -> KnowledgeBook`.
- RAG governado por manifesto seguro.
- Agent/RAG autenticado protegido por BookAccess e filtro editorial por `bookId` canonico, com fail-closed para escopo invalido ou indisponivel.
- Frontend Aluno/Professor usando BookAccess como authority privada; query string e localStorage permanecem nao autoritativos.
- `StudyGroupId` dinamico como string de runtime no frontend, com `DemoGroupSlug` restrito a fixtures demonstrativos.
- Rotas publicas `/materiais/:groupSlug` resolvidas dinamicamente por `/api/studies`, separadas da capability publica de Knowledge.
- Corpus governado com identidade editorial/fisica, estado operacional e rebuild administrativo.
- Bootstrap automatico assincrono do corpus no startup da API.
- Agent Answer com precedencia de `groupId` explicito dentro do escopo BookAccess autorizado e retrieval filtrado.
- Provider Groq configuravel para producao.
- Fallback LLM seguro.
- Infraestrutura SMTP configuravel com `nodemailer`.
- Mailpit para desenvolvimento local.
- Recuperacao e redefinicao de senha ja implementadas em codigo.
- Hardening production/demo/local do frontend autenticado.
- Identidade publica e timezone institucional nos e-mails transacionais.
- Readiness de banco/Neon com retry curto e limitado.
- Metadata segura de revisao via `GET /version`.
- Observabilidade SMTP transacional inicial com eventos estruturados e sanitizados.
- PROD-OBS-001 publicado com revision match, health ok e readiness estavel.
- SMTP-SMOKE-001 aprovado para evento real de sucesso `password_recovery`, sem retry e sem teste de falha em producao.

## Entregas Encerradas

### 9C.12 -- Hardening final de experiencia, identidade transacional e validacao

Encerrada quanto ao escopo consolidado de experiencia, identidade transacional e validacao.

#### 9C.12.1 -- Frontend production/demo mode hardening

Concluida e integrada pelo PR #47 no commit `cf61c4d8d10b6c513e7db9d5e8bce114179bb685`. Producao real nao exibe credenciais demonstrativas nem copy de backend/local nas telas de autenticacao. GitHub Pages permanece em modo demo seguro e desenvolvimento local continua utilizavel.

#### GROUP-BOOTSTRAP-001 -- Grupos produtivos governados

Concluido e integrado pelo rollout MULTIGROUP-001D. A entrega evoluiu `StudyGroup` para bootstrap produtivo explicito, relacionou grupos canonicos a `KnowledgeBook`, manteve campos operacionais opcionais e impediu fallback estatico silencioso em `/api/studies` quando a API esta conectada ao banco.

Finding separado:

- F-001 -- P3: variable/flaky timeouts in unmodified tests, without evidence of relation to 9C.12.1. Aberto originalmente como P2 durante 9C.12.1, foi reclassificado para P3 apos a reavaliacao formal F-001A.

#### 9C.12.2 -- Identidade e timezone dos e-mails transacionais

Concluida e integrada pelo PR #48 no commit `400038c8299ce9cd3db99f424a246774ce83bb32`. Password recovery usa o subject `Recuperação de acesso — Portal de Educação Continuada`; account invitation usa `Seu acesso ao Portal de Educação Continuada`; expiracoes usam `America/Sao_Paulo` e copy `horário de Brasília`. TTL, transporte SMTP, Resend, Render, DNS, Neon e banco nao foram alterados.

Finding separado:

- W-001 foi aberto como P3 nesta etapa apos W-001A identificar escopo material em metadados publicos da Web e no default versionado de `SMTP_FROM_NAME`. Posteriormente foi corrigido, integrado, publicado e validado; estado atual: RESOLVIDO. Ver a secao W-001 encerrada.

#### 9C.12.3 -- Documentacao e validacao final

Concluida e integrada pelo PR #49 no commit `75d8baaa3878ad5a0c57a844ef09e0cb534dcab2`. Esta etapa corrigiu documentacao desatualizada apos 9C.12.1 e 9C.12.2, formalizou a distincao entre nome interno/historico do projeto e identidade publica do produto, preservou findings nao bloqueantes e registrou validacao local final. Nao alterou runtime, testes, `.env.example`, Render, Resend, DNS, Neon, banco, deploy ou SMTP real.

Validacao local executada nesta etapa:

- testes focados Web de autenticacao/configuracao/recovery/routing: 4 arquivos, 27 testes, PASS;
- testes focados API de e-mail transacional: 3 arquivos, 8 testes, PASS;
- fluxos API relacionados a recuperacao, convites, inscricoes e auth: 4 arquivos, 164 testes, PASS;
- suite completa API: 61 arquivos, 708 testes, PASS;
- suite completa Web: 42 arquivos, 460 testes, PASS;
- typecheck Web e API, build oficial e `make pages-check`: PASS.

### PILOT-01 -- Hardening operacional do readiness

Concluido e integrado pelo PR #51 no commit `11b2e0dfa01a40c6b8b8321cee03c48a47e1536b`. A entrega adicionou retry curto e limitado para readiness de banco/Neon, com timeout controlado e contrato publico preservado.

### PILOT-02 -- Metadata segura de revisao

Concluido, publicado, validado operacionalmente e encerrado pelo PR #52 no commit `a336b6e540d6bc5624b6448ae96507696c3a8f57`. A entrega adicionou `GET /version`, revisao sanitizada via `RENDER_GIT_COMMIT` e fallback seguro `unknown`. DEP-002 esta resolvido.

### OBS-001 -- Observabilidade inicial de SMTP transacional

Integrado e Git-closed pelo PR #53 no commit `2a419c660768166071fc6af811e3b90fab2d6336`. A entrega adicionou eventos SMTP estruturados e sanitizados para sucesso/falha, com tipos `password_recovery` e `account_invitation`, sem expor destinatario, e-mail, token, URL sensivel, secrets, erro bruto sensivel ou resposta bruta do Nodemailer.

Publicado em producao em PROD-OBS-001 pela revisao `e965352f5c76627d706362bc18ec6c8539c9c8a6`. A validacao operacional confirmou `/version` com `REVISION_MATCH`, `/health` HTTP 200 `status=ok`, `/ready` estavel em 5/5 chamadas com `database=ok`, `corpus=ready` e `status=ready`. OPS-001 nao foi criado.

### GOV-001B -- Reconciliacao documental pos-OBS-001

Integrado e Git-closed pelo PR #54 no commit `e965352f5c76627d706362bc18ec6c8539c9c8a6`, reconciliando a governanca viva apos OBS-001.

### GOV-002 -- Reconciliacao documental pos-PROD-OBS-001

Integrado e Git-closed pelo PR #55 no commit `9aa04eba56869810e65cce6e30d6fcc6b7cf7759`. O escopo foi exclusivamente documental e nao alterou producao.

### PROD-OBS-001 -- Publicacao controlada do OBS-001

Concluido. Na etapa PROD-OBS-001, a API de producao foi publicada em `e965352f5c76627d706362bc18ec6c8539c9c8a6`, com `/version`, `/health` e `/ready` validados. OPS-001 nao foi criado. O estado live atual da API esta registrado no topo deste plano.

### SMTP-SMOKE-001 -- Smoke transacional real controlado

Aprovado com uma unica solicitacao real de recuperacao de senha em producao via `POST /api/auth/forgot-password`, sem retry. A resposta publica retornou HTTP 200 com anti-enumeration preservado. O evento observado foi `transactional_email_send_succeeded`, com `messageType=password_recovery`, `result=succeeded` e `durationMs=1354`.

O evento foi observado sanitizado, sem recipient/e-mail, token, reset URL, corpo de mensagem, secrets, erro bruto, resposta bruta do Nodemailer ou stack sensivel. OBS-SEC-001 nao foi criado.

Limites: o smoke nao validou `transactional_email_send_failed` em producao, fluxo de convite, entregabilidade universal, bounce, uso do reset URL, expiracao do token ou redefinicao de senha. O link de redefinicao nao foi utilizado, a senha nao foi redefinida e o recebimento final na caixa ficou nao verificado.

### W-001 -- Alinhamento da identidade publica

Encerrado. W-001A auditou e identificou escopo material em metadados publicos da Web e no default versionado de `SMTP_FROM_NAME`; W-001B corrigiu o source; o PR #59 foi integrado pelo squash `1f92154cdaad211bcc7c080220f5df253f54f472`; GitHub Pages foi publicado e validado; a Web oficial foi publicada no deploy Render `dep-d9v7bregekts73evo580`, live em `1f92154cdaad211bcc7c080220f5df253f54f472`; a metadata publica foi validada com `title`, `og:title`, `og:site_name` e `twitter:title` como `Portal de Educação Continuada`; o smoke publico read-only foi aprovado. A API nao foi redeployada nesta entrega.

### MULTIGROUP-001 -- Vinculo multi-grupo de professores

Encerrado. O projeto possui vinculo persistente multi-grupo para usuarios `TEACHER` via `TeacherStudyGroup`, com chave composta `userId/groupId`. Esse vinculo e usado por rotas autenticadas de encontros, por endpoints administrativos de associacao de grupos do professor e, apos BOOK-ACCESS-001A/B/C, como fonte persistida para calcular o escopo TEACHER autorizado. A existencia dessa fundacao nao libera Professor real automaticamente.

### MULTIGROUP-001D -- Rollout controlado de producao

Encerrado. O rollout controlado aplicou migrations de producao, validou `KnowledgeBook` canonicos, materializou `StudyGroup` canonicos, publicou a API em `47917158545338cf442f97ebe8b3a4aee2feed86` e publicou a Web inicialmente no mesmo SHA.

O aceite manual da Web inicial encontrou stale demo leakage na Home. A correcao 001D.5A foi integrada pelo PR #67 no squash `7818eabc81bf0152ec109468a79422e85783893a`, mudando a Home para consumir `listStudies()`/`/api/studies` como autoridade operacional. A etapa 001D.5B redeployou somente a Web no deploy `dep-da4poe3l550s738kmti0`, manteve a API em `47917158545338cf442f97ebe8b3a4aee2feed86` e teve aceite manual final aprovado.

Estado funcional validado:

- Home sem `88 participantes`, `62 participantes`, agenda demo, datas demo ou Meet demo;
- `/portal` com dois grupos reais e sem dados operacionais ficticios;
- `/materiais` funcional e terminal;
- `/professor` protegido, redirecionando para `/login` sem autenticacao;
- `/estudos` nao existe no contrato atual e permanece `NOT_APPLICABLE`.

Observacao historica daquele momento: o catalogo PostgreSQL conhecido tinha Emmanuel com 19 documentos, A Caminho da Luz com 13 documentos e `shared` com 2 documentos, enquanto o corpus publico exposto por `/api/knowledge/groups` havia sido revalidado com Emmanuel `fileCount=1` e A Caminho da Luz `fileCount=0`. Esse desalinhamento catalogo/corpus permaneceu fora do escopo de MULTIGROUP-001D e foi tratado posteriormente por CORPUS-COVERAGE-001A/001B.

CORPUS-COVERAGE-001A corrige a interpretacao operacional desse finding: `catalog count` nao e `expected corpus count`. A cobertura governada deve ser medida por `StudyGroup` ativo vinculado a `KnowledgeBook` ativo, com ao menos uma fonte pedagogica aprovada, fisicamente valida e incluida no manifesto editorial para o `bookId` canonico. Documentos nao aprovados nao contam como corpus; fonte `readme` isolada nao basta; `shared` nao mascara livro sem fonte propria. O gate e read-only e nao executa aprovacao editorial, migration, seed, bootstrap, rebuild, deploy ou mutacao de producao.

### BOOK-ACCESS-001A -- Backend access authority

Integrado pelo PR #69 no commit `ae788e9747029ac8f602ace179f0cfbfa6bd3d25`. A entrega implementou `GET /api/me/book-access` como authority backend privada: `STUDENT` deriva escopo do grupo persistido no usuario, `StudyGroup` ativo e `KnowledgeBook` ativo; `TEACHER` deriva escopo de `TeacherStudyGroup`, `StudyGroup` ativo e `KnowledgeBook` ativo; `VISITOR` e `ADMIN` nao recebem acesso pedagogico automatico. Migration: `NOT_REQUIRED`.

### BOOK-ACCESS-001B -- Agent/RAG canonical book access

Integrado pelo PR #70 no commit `6eb461edcd4970af55e44b4247b65a5a60c2de53`. Agent/RAG autenticados passaram a ser protegidos por BookAccess e por filtro editorial de `bookId` canonico. O grupo selecionado fica imutavel durante a request; `bookTitle`, hints de frontend, query string e estado local nao concedem acesso; conteudo `shared` depende de politica explicita; conflitos e indisponibilidade falham fechado. Migration: `NOT_REQUIRED`.

### BOOK-ACCESS-001C -- Frontend canonical BookAccess

Integrado pelo PR #71 no commit `c908373b7a19d3a13f639689671cf2d5df9b618c`. As paginas de Aluno e Professor passaram a usar `GET /api/me/book-access` como authority privada. `listStudies` permanece enrichment publico, meetings permanecem agenda, e query/localStorage sao reconciliados como estado nao autoritativo. Migration: `NOT_REQUIRED`.

BOOK-ACCESS-001 esta com implementacao de codigo concluida ate 001C; BOOK-ACCESS-001D permanece pendente para rollout controlado. Professor real continua HOLD.

### DYNAMIC-GROUPS-001 -- Identidades dinamicas de grupos no frontend

Integrado pelo PR #72 no commit `06b2256dd95b9605a01667c0511dc9dabcd44e4c`. `StudyGroupId` passou a ser string dinamica de runtime, `DemoGroupSlug` permaneceu estrito a fixtures demo, o adapter de BookAccess deixou de usar allowlist local, novo grupo autorizado nao e descartado pelo frontend e Knowledge desconhecido falha fechado sem coercao para Emmanuel. Backend Knowledge nao foi alterado. Migration: `NOT_REQUIRED`.

### PUBLIC-MATERIALS-DYNAMIC-001 -- Rotas publicas dinamicas de materiais

Integrado pelo PR #73 no commit `8654febc66c66a8cf0a19826abe2ce9a1097c694`. `/materiais/:groupSlug` passou a resolver o grupo dinamicamente pelo catalogo publico `GET /api/studies`; a allowlist local foi removida; grupo publico conhecido sem Knowledge apresenta estado seguro `Materiais em preparação`; slug ausente vira true not-found somente apos resolucao do catalogo; falha de catalogo nao vira falso 404. Backend Knowledge nao foi alterado. Migration: `NOT_REQUIRED`.

### CORPUS-COVERAGE-001A -- Diagnostico de cobertura governada

Aprovado, integrado pelo PR #75 e Git-closed na `main` `a37003f692da7e381b67aa6df25bcfbb47fd4ce3`. A entrega definiu que coverage e `StudyGroup` ativo -> `KnowledgeBook` ativo -> fonte pedagogica aprovada e utilizavel no manifesto governado. Catalog count nao precisa igualar corpus count; documentos catalogados nao aprovados podem permanecer legitimamente fora do RAG.

### CORPUS-COVERAGE-001B -- Restauracao minima de cobertura em producao

Aprovado e concluido como operacao controlada de producao. O alvo exclusivo foi `a-caminho-da-luz-visao-geral`, tipo `VISAO_GERAL`, com fluxo editorial `DRAFT -> REVIEWED -> APPROVED` e versao `1 -> 2 -> 3`. Nenhum outro `KnowledgeDocument` de A Caminho da Luz foi aprovado.

O snapshot editorial final conhecido e A Caminho da Luz total `13`, `DRAFT=12`, `APPROVED=1`; Emmanuel total `19`, `DRAFT=18`, `APPROVED=1`; `shared` total `2`, `DRAFT=2`, `APPROVED=0`. Esses numeros sao registro operacional pos-001B, nao requisito permanente.

Antes do rebuild governado, o corpus tinha 1 source, 1 documento e 5 chunks. Depois de uma unica execucao controlada bem-sucedida, passou a 2 sources, 2 documentos e 11 chunks, com fingerprint alterado, `/ready` em `ready`, database `ok` e corpus `ready`. O publico ficou com Emmanuel `fileCount=1` e A Caminho da Luz `fileCount=1`, expondo `A Caminho da Luz - visao geral da obra`. Nao houve deploy de codigo, migration, seed, `knowledge:catalog`, `groups:bootstrap`, alteracao de source Markdown, Git, Render, Professor/User, SQL write direto ou Prisma write direto.

## Backlog Atual

- F-001 -- P3: timeouts historicos variaveis/flaky em testes nao modificados; F-001A nao reproduziu o problema, validou testes historicos Web/API repetidamente, suites completas Web/API e CIs recentes, sem evidencia de mascaramento por aumento global de timeout. Permanece como risco residual/historico.
- DOC-001 -- RESOLVIDO: stale factual em documentos auxiliares corrigido, documentos historicos explicitamente marcados, contratos executaveis reconciliados e nenhum runtime alterado.
- BOOK-ACCESS-001 -- IMPLEMENTACAO DE CODIGO CONCLUIDA ATE 001C; 001D PENDENTE: backend BookAccess, Agent/RAG protegido e frontend Aluno/Professor ja foram integrados. Falta rollout controlado BOOK-ACCESS-001D.
- PUBLIC-KNOWLEDGE-DYNAMIC-001 -- DEFERRED / NOT STARTED: rotas publicas de materiais ja sao dinamicas por `/api/studies`, mas backend publico de Knowledge continua capability de dois grupos (`emmanuel` e `a-caminho-da-luz`) e deve falhar fechado para grupos desconhecidos.
- CORPUS-COVERAGE-001 -- ENCERRADO: CORPUS-COVERAGE-001A foi integrado pelo PR #75 e Git-closed em `a37003f692da7e381b67aa6df25bcfbb47fd4ce3`; CORPUS-COVERAGE-001B foi concluido em producao com workflow administrativo oficial, uma aprovacao editorial especifica e uma unica reconstrução controlada do corpus. Emmanuel e A Caminho da Luz estao `COVERED`; overall governed coverage esta `READY`.
- Professor -- HOLD: nao ha provisioning real liberado neste estado; nao registrar credenciais nem e-mail pessoal. `TeacherStudyGroup` e fonte de escopo TEACHER em BookAccess, mas nao autoriza criacao de Professor real.
- Rate limit de password recovery/reset em memoria do processo: P2 conceitual antes de escala horizontal, nao bloqueante enquanto houver replica unica.
- Observabilidade SMTP futura: dashboard, metricas agregadas, webhooks, integracoes de provider, fluxo de convite e caminho SMTP de falha em producao permanecem fora do escopo atual e dependem de necessidade operacional concreta.

## Sequencia Recomendada

1. GOV-005 -- reconciliacao documental pos CORPUS-COVERAGE-001.
2. BOOK-ACCESS-001D -- rollout controlado de BookAccess.

PUBLIC-KNOWLEDGE-DYNAMIC-001 permanece deferred, a menos que futuramente seja necessario publicar conteudo Knowledge de novos grupos. Professor real permanece HOLD.
