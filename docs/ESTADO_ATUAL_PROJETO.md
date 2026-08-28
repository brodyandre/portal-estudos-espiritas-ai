# Estado Atual do Projeto

Estado Git esperado:

- branch oficial: `main`;
- `HEAD`, `main` e `origin/main` sincronizados;
- ahead/behind esperado entre `main` e `origin/main`: `0 0`;
- workspace limpo.

O SHA efetivo da `main` deve ser verificado operacionalmente via Git no inicio de cada checkpoint, em vez de inferido a partir deste documento.

Produção conhecida:

- Web oficial: `https://portal-educacao-continuada.com.br`, revisão live conhecida/validada `7818eabc81bf0152ec109468a79422e85783893a`, deploy Render `dep-da4poe3l550s738kmti0`, serviço Render `portal-estudos-web` (`srv-d9qa5pbm8hqs73eak6i0`), tipo `static_site`;
- API: `https://api.portal-educacao-continuada.com.br`, revisão live conhecida/validada `47917158545338cf442f97ebe8b3a4aee2feed86`, deploy Render `dep-da4ooms9v7es738rb7n0`, serviço Render `portal-estudos-api` (`srv-d9pp5it3erlc739asjt0`);
- `Auto-Deploy = Off/no` observado na Web como estado operacional, não como decisão arquitetural imutável;
- MULTIGROUP-001D está aprovado e o rollout controlado de produção foi concluído.

A Web oficial foi publicada manualmente e validada na revisão `7818eabc81bf0152ec109468a79422e85783893a`, que inclui a correção da Home para consumir `/api/studies` via `listStudies()`. A API permanece na revisão runtime conhecida `47917158545338cf442f97ebe8b3a4aee2feed86`. Essa diferença por superfície é esperada e não representa, por si só, drift indevido; o rollout corretivo da Web não exigiu deploy da API nem alinhamento numérico entre Web e API.

## Identificacao

Portal de Estudos Espiritas com IA, monorepo privado com API Express/TypeScript e Web React/Vite. O objetivo e apoiar grupos de estudo com areas publicas, aluno, professor e administracao, preservando revisao humana e governanca editorial.

Nome interno/historico do projeto: Portal de Estudos Espiritas com IA.

Identidade publica atual do produto: Portal de Educação Continuada.

## Arquitetura Principal

- `apps/web`: frontend React, TypeScript, Vite e React Router.
- `apps/api`: API Node.js, Express, TypeScript, Prisma, PostgreSQL, LangChain/LangGraph e providers LLM configuraveis.
- `data/knowledge`: armazenamento fisico governado de documentos Markdown autorizados.
- `docs`: documentacao tecnica e operacional.

## Banco e Persistencia

O banco configurado e PostgreSQL via Prisma. Fluxos persistidos incluem usuarios, sessoes, convites de conta, tokens de recuperacao de senha, encontros, catalogo editorial, corpus governado e auditoria.

## Producao

- Web: `https://portal-educacao-continuada.com.br`
- API: `https://api.portal-educacao-continuada.com.br`

Estado operacional oficial previamente validado:

- Web oficial live em `7818eabc81bf0152ec109468a79422e85783893a`, com smoke read-only em `/`, `/portal`, `/materiais` e `/login`;
- API `/version = 47917158545338cf442f97ebe8b3a4aee2feed86`
- API `/health = OK`
- API `/ready = ready`
- API `database = ok`
- API `corpus = ready`
- API `/api/studies` retorna `emmanuel` e `a-caminho-da-luz` com campos operacionais ainda não configurados como `null`;
- `GET /api/knowledge/groups` expõe atualmente `fileCount=1` para Emmanuel e `fileCount=1` para A Caminho da Luz.

## CI/CD

Ha workflows GitHub Actions para:

- CI em PRs e pushes para `main`: typecheck, testes, build e `make pages-check`.
- Publicacao do frontend no GitHub Pages em modo demonstrativo.

Artefatos de container para API e Web estao documentados em `docs/deployment.md`.

## Autenticacao e Administracao

A API possui autenticacao local com JWT, sessoes persistidas, papeis `VISITOR`, `STUDENT`, `TEACHER` e `ADMIN`, troca de senha, recuperacao de senha, convites de conta e administracao de usuarios. Rotas administrativas exigem autenticacao e autorizacao.

## Grupos e Encontros

O projeto possui grupos de estudo, atribuicao administrativa de grupos e gerenciamento de encontros. Professores possuem vinculo persistente multi-grupo normalizado por `TeacherStudyGroup`, com chave composta `userId/groupId`; alunos mantem o vinculo canonico atual no usuario. A area autenticada do aluno consome encontros associados ao usuario, e professores podem consumir encontros agregados dos grupos ativos vinculados.

`StudyGroupId` no frontend e identidade string dinamica de runtime. `DemoGroupSlug` permanece restrito a fixtures demonstrativos. A existencia de uma string de grupo nao concede acesso: escopo privado vem de BookAccess autenticado; navegacao publica de materiais vem de `/api/studies`.

## Catalogo Editorial

O catalogo editorial de conhecimento usa livros e documentos persistidos. Livros ativos e documentos aprovados sao a autoridade editorial para inclusao no manifesto seguro do RAG. Arquivos fisicos precisam estar dentro de `data/knowledge`. Em producao, os livros canonicos ativos incluem `Emmanuel` e `A Caminho da Luz`; tambem existe conteudo compartilhado conforme catalogo persistido.

## RAG e Corpus Governado

O RAG publico usa corpus governado, nao varredura livre do filesystem. A inclusao exige livro ativo, documento aprovado, caminho relativo permitido e arquivo Markdown valido. O sistema falha fechado se o corpus governado nao puder ser montado.

Bootstrap automatico do corpus ja foi validado com:

- `knowledge_corpus_bootstrap_started`
- `knowledge_corpus_bootstrap_succeeded`
- `state = ready`
- `manifestSourceCount = 2`
- `documentCount = 2`
- `chunkCount = 11`
- `stale = false`

Observacao operacional separada: apos CORPUS-COVERAGE-001B, o catalogo PostgreSQL e o corpus publico/RAG exposto pela interface seguem intencionalmente sem exigencia de alinhamento numerico. O snapshot operacional conhecido do catalogo persistido e Emmanuel com 19 documentos, A Caminho da Luz com 13 documentos e `shared` com 2 documentos; o endpoint publico `/api/knowledge/groups` foi revalidado com Emmanuel expondo 1 arquivo e A Caminho da Luz expondo 1 arquivo. A fonte publica de A Caminho da Luz e `A Caminho da Luz - visao geral da obra`. Isso nao significa que todos os 13 documentos de A Caminho da Luz estejam publicos.

CORPUS-COVERAGE-001A formaliza que `catalog count` nao e `expected corpus count`. O diagnostico correto de cobertura e: `StudyGroup` ativo, `KnowledgeBook` ativo vinculado e ao menos uma fonte pedagogica aprovada, fisicamente valida e efetivamente incluida no manifesto governado para o `bookId` canonico. Documentos catalogados em `DRAFT`, `NEEDS_REVIEW`, `REVIEWED` ou `ARCHIVED` podem existir legitimamente sem entrar no corpus. Fonte `readme` isolada nao satisfaz cobertura pedagogica, e conteudo `shared` nao mascara livro sem fonte propria.

CORPUS-COVERAGE-001B foi concluido operacionalmente em producao por workflow administrativo oficial, sem alterar source Markdown, Git, codigo, Render deploy, migration, seed, `knowledge:catalog`, `groups:bootstrap`, Professor/User, SQL write direto ou Prisma write direto. O documento exclusivo `a-caminho-da-luz-visao-geral`, tipo `VISAO_GERAL`, avancou `DRAFT -> REVIEWED -> APPROVED`, versao `1 -> 2 -> 3`. Nenhum outro `KnowledgeDocument` de A Caminho da Luz foi aprovado. O rebuild governado foi executado uma unica vez e concluiu com sucesso; antes dele o corpus tinha 1 source, 1 documento e 5 chunks, e depois passou a 2 sources, 2 documentos e 11 chunks, com fingerprint alterado. A cobertura governada final esta `READY`, com Emmanuel `COVERED` e A Caminho da Luz `COVERED`.

## Agent Answer, Group Matching e LLM

O Agent Answer autenticado usa BookAccess como authority privada e filtra retrieval pelo `bookId` editorial canonico. `groupId`, `bookTitle`, hints de frontend, query string e localStorage nao concedem acesso nem trocam o escopo autorizado. O grupo selecionado e imutavel durante a request; conflito, indisponibilidade ou ausencia de escopo autorizado falham fechado. O Agent Answer tambem preserva `groupId` explicito valido dentro do escopo autorizado, evita `broad_search` indevido em perguntas neutras e mantem filtros de retrieval do grupo selecionado.

Provider principal em producao: Groq.

Validacao operacional oficial:

- `provider = groq`
- `usedFallback = false`
- `fallbackReason = null`
- `group.id = emmanuel`
- `matchMode = selected_group`

Fallback do Agent Answer permanece preservado para falhas do provider LLM.

## E-mail Transacional e Recuperacao de Senha

O codigo possui `nodemailer`, infraestrutura SMTP configuravel, Mailpit local, notifiers transacionais, recuperacao de senha, reset de senha, token criptograficamente seguro, armazenamento por hash, expiracao, uso unico, anti-enumeracao, templates HTML/texto e frontend para solicitacao e redefinicao.

Estado operacional validado da 9C.11:

- provider SMTP inicial de producao: Resend;
- transporte da aplicacao: SMTP padrao via Nodemailer;
- dominio de envio: `email.portal-educacao-continuada.com.br`;
- regiao Resend: Sao Paulo (`sa-east-1`);
- dominio Resend verificado, Sending habilitado e Receiving desabilitado;
- DNS oficial do Resend aplicado no Registro.br para DKIM, Return-Path/SPF e SPF;
- remetente institucional: `Portal de Educação Continuada <no-reply@email.portal-educacao-continuada.com.br>`;
- credencial restrita criada no Resend com permissao de envio para o dominio aprovado, mantida fora do repositorio;
- API em producao configurada com `SMTP_ENABLED=true`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=2587`, `SMTP_SECURE=false`, `SMTP_USER=resend`, remetente institucional e `APP_PUBLIC_URL=https://portal-educacao-continuada.com.br`.

Smoke real controlado da recuperacao de senha foi concluido com sucesso: solicitacao publica com resposta generica, entrega Resend `Sent` e `Delivered`, recebimento no endereco controlado, link HTTPS para `/redefinir-senha`, redefinicao de senha, redirecionamento para `/login`, login com a nova senha e acesso autenticado a `/aluno`.

Nenhum valor secreto, token, senha, API key, URL completa com token ou e-mail pessoal usado no smoke deve ser documentado.

## Fechamento 9C.12 e Pós-Piloto

9C.12.1 foi integrada pelo PR #47 no commit de integracao `cf61c4d8d10b6c513e7db9d5e8bce114179bb685`. A producao real nao exibe credenciais demonstrativas nem copy de backend/local nas telas de autenticacao; o GitHub Pages permanece em modo demo seguro; o desenvolvimento local continua utilizavel.

9C.12.2 foi integrada pelo PR #48 no commit de integracao `400038c8299ce9cd3db99f424a246774ce83bb32`. Os e-mails transacionais usam a identidade publica `Portal de Educação Continuada`, formatam expiracao com `America/Sao_Paulo` e apresentam o horario como `horário de Brasília`. A alteracao nao mudou TTL, transporte SMTP, Resend, Render, DNS, Neon ou banco.

9C.12.3 foi concluida e integrada pelo PR #49 no commit de integracao `75d8baaa3878ad5a0c57a844ef09e0cb534dcab2`. Nesta etapa, passaram os testes focados Web relacionados a auth/config/recovery/routing (4 arquivos, 27 testes), os testes focados API de templates transacionais (3 arquivos, 8 testes), os fluxos API relacionados (4 arquivos, 164 testes), a suite completa API (61 arquivos, 708 testes), a suite completa Web (42 arquivos, 460 testes), os typechecks Web/API, o build oficial e `make pages-check`.

PILOT-01 foi integrado e encerrado pelo PR #51 no commit de integracao `11b2e0dfa01a40c6b8b8321cee03c48a47e1536b`. O hardening operacional do readiness para banco/Neon adicionou retry limitado e timeout controlado, preservando o contrato publico.

PILOT-02 foi integrado, publicado, validado operacionalmente e encerrado pelo PR #52 no commit de integracao `a336b6e540d6bc5624b6448ae96507696c3a8f57`. A entrega adicionou `GET /version` com revisao sanitizada via `RENDER_GIT_COMMIT` e fallback seguro `unknown`. DEP-002 esta resolvido.

OBS-001 foi integrado e Git-closed pelo PR #53 no commit de integracao `2a419c660768166071fc6af811e3b90fab2d6336`. A entrega adicionou observabilidade SMTP transacional inicial com eventos estruturados e sanitizados para sucesso/falha, cobrindo `password_recovery` e `account_invitation`, sem registrar destinatario, e-mail, token, URL sensivel, secrets, erro bruto sensivel ou resposta bruta do Nodemailer.

GOV-001B foi integrado e Git-closed pelo PR #54 no commit de integracao `e965352f5c76627d706362bc18ec6c8539c9c8a6`, reconciliando a governanca viva pos-OBS-001.

GOV-002 foi integrado e Git-closed pelo PR #55 no commit de integracao `9aa04eba56869810e65cce6e30d6fcc6b7cf7759`. O escopo foi exclusivamente documental e nao alterou producao.

PROD-OBS-001 publicou a revisao `e965352f5c76627d706362bc18ec6c8539c9c8a6` no servico `portal-estudos-api` e validou `/version` com `REVISION_MATCH`, `/health` HTTP 200 `status=ok` e `/ready` estavel em 5/5 chamadas com `database=ok`, `corpus=ready` e `status=ready`. OPS-001 nao foi criado.

SMTP-SMOKE-001 foi aprovado com uma unica solicitacao real de recuperacao de senha em producao via `POST /api/auth/forgot-password`, sem retry. A resposta publica retornou HTTP 200 com anti-enumeration preservado. O evento real observado foi `transactional_email_send_succeeded`, com `messageType=password_recovery`, `result=succeeded` e `durationMs=1354`. O evento foi observado sanitizado, sem recipient/e-mail, token, reset URL, corpo de mensagem, secrets, erro bruto, resposta bruta do Nodemailer ou stack sensivel. OBS-SEC-001 nao foi criado.

O smoke nao validou o caminho `transactional_email_send_failed` em producao, fluxo de convite, entregabilidade universal, bounce, uso do reset URL, expiracao do token ou redefinicao de senha. O link de redefinicao nao foi utilizado, a senha nao foi redefinida e o recebimento final na caixa ficou nao verificado.

A 9C.12, PILOT-01, PILOT-02, OBS-001, PROD-OBS-001 e SMTP-SMOKE-001 estao encerrados quanto ao escopo correspondente. Os achados remanescentes abaixo seguem como backlog separado.

GROUP-BOOTSTRAP-001 foi concluido e integrado no rollout MULTIGROUP-001D. A entrega preparou `StudyGroup` para campos operacionais opcionais, adicionou relacao governada opcional com `KnowledgeBook`, criou `groups:bootstrap` explicito para os grupos canonicos e tornou `/api/studies` DB-backed em producao, com falha fechada se faltar livro vinculado. Os grupos canonicos materializados em producao sao `emmanuel` e `a-caminho-da-luz`.

MULTIGROUP-001 tambem foi concluido: existe vinculo persistente multi-grupo para usuarios `TEACHER` por `TeacherStudyGroup`, com PK composta `userId/groupId`.

MULTIGROUP-001D foi aprovado como rollout controlado de producao concluido:

- 001D.1 aplicou e validou migrations de producao;
- 001D.2 materializou e validou os `KnowledgeBook` canonicos;
- 001D.3 materializou os `StudyGroup` canonicos;
- 001D.4 publicou a API em `47917158545338cf442f97ebe8b3a4aee2feed86`;
- 001D.5 publicou inicialmente a Web no mesmo SHA, mas o aceite manual encontrou stale demo leakage na Home;
- 001D.5A integrou o PR #67, `fix(web): use production studies on home`, corrigindo a Home para usar `listStudies()`/`/api/studies` como autoridade operacional;
- 001D.5B redeployou a Web em `7818eabc81bf0152ec109468a79422e85783893a`, com aceite manual final aprovado.

A Home de producao nao usa mais `groups` demo como autoridade operacional e o aceite manual final confirmou ausencia de `88 participantes`, `62 participantes`, agenda demonstrativa, datas demonstrativas e Meet demonstrativo. `/portal` foi validado com os dois grupos reais e sem dados operacionais ficticios. `/materiais` esta funcional e terminal. `/professor` permanece rota protegida e, sem autenticacao, redireciona para `/login`. `/estudos` nao existe no contrato atual e permanece `NOT_APPLICABLE`.

BOOK-ACCESS-001A foi integrado pelo PR #69 no commit de integracao `ae788e9747029ac8f602ace179f0cfbfa6bd3d25`. A entrega implementou a authority backend de BookAccess em `GET /api/me/book-access`: alunos derivam escopo do grupo persistido no usuario, `StudyGroup` ativo e `KnowledgeBook` ativo; professores derivam escopo de `TeacherStudyGroup`, `StudyGroup` ativo e `KnowledgeBook` ativo; `VISITOR` e `ADMIN` nao recebem acesso pedagogico automatico. Migration: `NOT_REQUIRED`.

BOOK-ACCESS-001B foi integrado pelo PR #70 no commit de integracao `6eb461edcd4970af55e44b4247b65a5a60c2de53`. Agent/RAG autenticados passaram a ser protegidos pela authority BookAccess com filtro editorial por `bookId` canonico, grupo selecionado imutavel durante a request, fail-closed para escopo invalido/indisponivel, ausencia de acesso concedido por `bookTitle`/frontend e conteudo `shared` somente por politica explicita. Migration: `NOT_REQUIRED`.

BOOK-ACCESS-001C foi integrado pelo PR #71 no commit de integracao `c908373b7a19d3a13f639689671cf2d5df9b618c`. O frontend de Aluno/Professor passou a usar `GET /api/me/book-access` como authority privada; `listStudies` e enrichment publico, meetings sao agenda, e query/localStorage sao reconciliados como estado nao autoritativo. Migration: `NOT_REQUIRED`.

DYNAMIC-GROUPS-001 foi integrado pelo PR #72 no commit de integracao `06b2256dd95b9605a01667c0511dc9dabcd44e4c`. `StudyGroupId` tornou-se string dinamica de runtime, `DemoGroupSlug` permaneceu estrito a demo, o adapter de BookAccess deixou de depender de allowlist local, novo grupo autorizado nao e descartado pelo frontend e Knowledge desconhecido falha fechado sem coercao para Emmanuel. Backend Knowledge nao foi alterado. Migration: `NOT_REQUIRED`.

PUBLIC-MATERIALS-DYNAMIC-001 foi integrado pelo PR #73 no commit de integracao `8654febc66c66a8cf0a19826abe2ce9a1097c694`. `/materiais/:groupSlug` agora resolve dinamicamente pelo catalogo publico `GET /api/studies`; a allowlist local foi removida; grupo publico conhecido sem Knowledge mostra estado seguro `Materiais em preparação`; slug ausente vira true not-found somente apos resolucao do catalogo; falha de catalogo nao vira falso 404. Backend Knowledge nao foi alterado. Migration: `NOT_REQUIRED`.

CORPUS-COVERAGE-001A foi aprovado, integrado pelo PR #75 e Git-closed na `main` `a37003f692da7e381b67aa6df25bcfbb47fd4ce3`. A entrega definiu coverage como `StudyGroup` ativo -> `KnowledgeBook` ativo -> fonte pedagogica aprovada e utilizavel no manifesto governado, preservando que catalog count nao precisa igualar corpus count.

CORPUS-COVERAGE-001B foi aprovado e concluido como operacao controlada de producao. O alvo exclusivo foi `a-caminho-da-luz-visao-geral`; o fluxo editorial executado foi `DRAFT -> REVIEWED -> APPROVED`, versao `1 -> 2 -> 3`; o corpus governado foi reconstruido uma unica vez com sucesso; a cobertura minima de producao ficou restaurada para Emmanuel e A Caminho da Luz. Nao houve deploy de codigo, alteracao de Git, migration, seed, `knowledge:catalog`, `groups:bootstrap`, source Markdown, Professor/User, SQL write direto ou Prisma write direto.

BOOK-ACCESS-001 deve ser representado como implementacao de codigo concluida ate 001C, com BOOK-ACCESS-001D pendente para rollout controlado. Professor real permanece HOLD.

## Limites Pos-Validacao

Achados nao bloqueantes registrados para evolucao futura:

- readiness: apos a ativacao SMTP, `/ready` apresentou temporariamente `database.status=timeout` com corpus `ready`; a evidencia sugere comportamento compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP; PILOT-01 mitigou esse risco com retry curto e limitado;
- rate limit de recuperacao/redefinicao usa memoria do processo, aceitavel para piloto em replica unica, mas inadequado como autoridade distribuida antes de escala horizontal;
- F-001 -- P3: variable/flaky timeouts in unmodified tests, without evidence of relation to 9C.12.1. Aberto originalmente como P2, foi reavaliado na F-001A e reclassificado para P3 apos nao reproducao repetida, testes historicos Web/API verdes, suites completas Web/API verdes, CIs posteriores verdes e ausencia de evidencia de mascaramento por aumento global de timeout;
- W-001 -- RESOLVIDO: W-001A identificou escopo material em metadados publicos da Web e no default versionado de `SMTP_FROM_NAME`; W-001B corrigiu metadata publica Web, default versionado de `SMTP_FROM_NAME` e `.env.example`; o PR #59 integrou a correcao no squash `1f92154cdaad211bcc7c080220f5df253f54f472`; GitHub Pages foi publicado e validado; a Web oficial foi publicada manualmente de forma controlada no deploy Render `dep-d9v7bregekts73evo580`, live em `1f92154cdaad211bcc7c080220f5df253f54f472`; a validacao publica confirmou HTTP 200 e `title`, `og:title`, `og:site_name` e `twitter:title` como `Portal de Educação Continuada`, com a marca historica ausente nesses quatro campos; o smoke read-only passou em `/`, `/portal`, `/materiais`, `/inscricao`, `/robots.txt` e `/sitemap.xml`; a API nao foi redeployada; o default SMTP esta correto em source, a producao ja possuia override institucional correto e nenhum SMTP real foi executado nessa entrega;
- DOC-001 -- RESOLVIDO: stale factual em documentos auxiliares corrigido, documentos historicos explicitamente marcados, contratos executaveis reconciliados e nenhum runtime alterado;
- BOOK-ACCESS-001 -- IMPLEMENTACAO DE CODIGO CONCLUIDA ATE 001C; 001D PENDENTE: backend BookAccess, Agent/RAG protegido e frontend Aluno/Professor ja foram integrados. O rollout controlado BOOK-ACCESS-001D permanece pendente. Professor permanece HOLD e nao ha provisioning real liberado;
- DYNAMIC-GROUPS-001 -- INTEGRADO: `StudyGroupId` e string dinamica de runtime, `DemoGroupSlug` permanece demo-only e autorizacao privada continua vindo de BookAccess;
- PUBLIC-MATERIALS-DYNAMIC-001 -- INTEGRADO: rotas publicas `/materiais/:groupSlug` usam `/api/studies` como catalogo navegavel; public Knowledge permanece capability separada de dois grupos e falha fechado para grupos nao suportados;
- PUBLIC-KNOWLEDGE-DYNAMIC-001 -- DEFERRED / NOT STARTED: backend publico de Knowledge ainda nao e dinamico para novos grupos; isso nao bloqueia BookAccess privado nem rotas publicas de materiais;
- CORPUS-COVERAGE-001 -- ENCERRADO: CORPUS-COVERAGE-001A foi integrado pelo PR #75 e Git-closed em `a37003f692da7e381b67aa6df25bcfbb47fd4ce3`; CORPUS-COVERAGE-001B foi executado posteriormente de forma controlada em producao, aprovando exclusivamente `a-caminho-da-luz-visao-geral` e reconstruindo uma unica vez o corpus governado. O resultado final e Emmanuel `COVERED`, A Caminho da Luz `COVERED` e coverage governada `READY`;
- observabilidade SMTP inicial esta publicada em producao e teve evento real de sucesso validado para `password_recovery`; dashboard, metricas agregadas, webhooks, integracoes de provider, fluxo de convite e caminho SMTP de falha seguem fora do escopo atual.

## Proxima Entrega

Sequencia recomendada apos GOV-005: BOOK-ACCESS-001D rollout controlado. PUBLIC-KNOWLEDGE-DYNAMIC-001 permanece deferred, a menos que futuramente seja necessario publicar conteudo Knowledge de novos grupos. Evolucao de rate limit distribuido e observabilidade SMTP futura seguem no backlog. Professor permanece HOLD ate planejamento/autorizacao especificos.
