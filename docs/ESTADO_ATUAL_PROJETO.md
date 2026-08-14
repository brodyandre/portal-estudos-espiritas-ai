# Estado Atual do Projeto

Estado Git esperado:

- branch oficial: `main`;
- `HEAD`, `main` e `origin/main` sincronizados;
- ahead/behind esperado entre `main` e `origin/main`: `0 0`;
- workspace limpo.

O SHA efetivo da `main` deve ser verificado operacionalmente via Git no inicio de cada checkpoint, em vez de inferido a partir deste documento.

Produção conhecida:

- revisão live da API previamente validada: `e965352f5c76627d706362bc18ec6c8539c9c8a6`;
- `Auto-Deploy = Off`, conforme observação operacional do Render Dashboard;
- OBS-001 está integrado, Git-closed, publicado em produção e validado operacionalmente.

A `main` contém o runtime de `e965352f5c76627d706362bc18ec6c8539c9c8a6` mais alterações documentais posteriores. Produção continua na revisão runtime conhecida acima, sem drift funcional conhecido que justifique deploy. `Auto-Deploy = Off` permanece como estado operacional observado, não como decisão arquitetural imutável.

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

- `/version = e965352f5c76627d706362bc18ec6c8539c9c8a6`
- `/health = OK`
- `/ready = ready` em 5/5 chamadas controladas
- `database = ok`
- `corpus = ready`

## CI/CD

Ha workflows GitHub Actions para:

- CI em PRs e pushes para `main`: typecheck, testes, build e `make pages-check`.
- Publicacao do frontend no GitHub Pages em modo demonstrativo.

Artefatos de container para API e Web estao documentados em `docs/deployment.md`.

## Autenticacao e Administracao

A API possui autenticacao local com JWT, sessoes persistidas, papeis `VISITOR`, `STUDENT`, `TEACHER` e `ADMIN`, troca de senha, recuperacao de senha, convites de conta e administracao de usuarios. Rotas administrativas exigem autenticacao e autorizacao.

## Grupos e Encontros

O projeto possui grupos de estudo, atribuicao administrativa de grupos e gerenciamento de encontros. A area autenticada do aluno consome encontros associados ao usuario.

## Catalogo Editorial

O catalogo editorial de conhecimento usa livros e documentos persistidos. Livros ativos e documentos aprovados sao a autoridade editorial para inclusao no manifesto seguro do RAG. Arquivos fisicos precisam estar dentro de `data/knowledge`.

## RAG e Corpus Governado

O RAG publico usa corpus governado, nao varredura livre do filesystem. A inclusao exige livro ativo, documento aprovado, caminho relativo permitido e arquivo Markdown valido. O sistema falha fechado se o corpus governado nao puder ser montado.

Bootstrap automatico do corpus ja foi validado com:

- `knowledge_corpus_bootstrap_started`
- `knowledge_corpus_bootstrap_succeeded`
- `state = ready`
- `manifestSourceCount = 1`
- `documentCount = 1`
- `chunkCount = 5`
- `stale = false`

## Agent Answer, Group Matching e LLM

O Agent Answer preserva `groupId` explicito valido, evita `broad_search` indevido em perguntas neutras e mantem filtros de retrieval do grupo selecionado.

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

## Limites Pos-Validacao

Achados nao bloqueantes registrados para evolucao futura:

- readiness: apos a ativacao SMTP, `/ready` apresentou temporariamente `database.status=timeout` com corpus `ready`; a evidencia sugere comportamento compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP; PILOT-01 mitigou esse risco com retry curto e limitado;
- rate limit de recuperacao/redefinicao usa memoria do processo, aceitavel para piloto em replica unica, mas inadequado como autoridade distribuida antes de escala horizontal;
- F-001 -- P3: variable/flaky timeouts in unmodified tests, without evidence of relation to 9C.12.1. Aberto originalmente como P2, foi reavaliado na F-001A e reclassificado para P3 apos nao reproducao repetida, testes historicos Web/API verdes, suites completas Web/API verdes, CIs posteriores verdes e ausencia de evidencia de mascaramento por aumento global de timeout;
- W-001 -- P3: marca antiga permanece somente em fixtures `SMTP_FROM_NAME`, asserts negativos e contextos locais deliberados, sem impacto no runtime/template transacional;
- DOC-001 -- RESOLVIDO: stale factual em documentos auxiliares corrigido, documentos historicos explicitamente marcados, contratos executaveis reconciliados e nenhum runtime alterado;
- observabilidade SMTP inicial esta publicada em producao e teve evento real de sucesso validado para `password_recovery`; dashboard, metricas agregadas, webhooks, integracoes de provider, fluxo de convite e caminho SMTP de falha seguem fora do escopo atual.

## Proxima Entrega

Proximos itens ja previstos no backlog incluem acompanhamento do W-001, evolucao de rate limit distribuido antes de escala horizontal e observabilidade SMTP futura, sem testar caminho SMTP de falha em producao automaticamente.
