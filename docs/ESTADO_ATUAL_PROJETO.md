# Estado Atual do Projeto

Baseline Git atual de referência: `2a419c660768166071fc6af811e3b90fab2d6336`.

Estado Git esperado:

- branch oficial: `main`;
- `HEAD`, `main` e `origin/main`: `2a419c660768166071fc6af811e3b90fab2d6336`;
- workspace limpo.

Produção conhecida:

- revisão live da API previamente validada: `a336b6e540d6bc5624b6448ae96507696c3a8f57`;
- `Auto-Deploy = Off`, conforme observação operacional do Render Dashboard;
- OBS-001 está integrado em `main`, mas ainda não foi publicado em produção.

A diferença entre `main` e produção é temporária, intencional e controlada. Não deve ser tratada como incidente nem como evidência de que produção avançou automaticamente.

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

- `/health = OK`
- `/ready = ready`
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

OBS-001 ainda nao foi publicado em producao. O proximo passo operacional possivel e decidir e executar um deploy controlado dessa revisao, em checkpoint separado e sem assumir auto-deploy.

A 9C.12, PILOT-01, PILOT-02 e OBS-001 estao encerrados quanto ao escopo Git correspondente. Os achados remanescentes abaixo seguem como backlog separado.

## Limites Pos-Validacao

Achados nao bloqueantes registrados para evolucao futura:

- readiness: apos a ativacao SMTP, `/ready` apresentou temporariamente `database.status=timeout` com corpus `ready`; a evidencia sugere comportamento compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP; PILOT-01 mitigou esse risco com retry curto e limitado;
- rate limit de recuperacao/redefinicao usa memoria do processo, aceitavel para piloto em replica unica, mas inadequado como autoridade distribuida antes de escala horizontal;
- F-001 -- P2: variable/flaky timeouts in unmodified tests, without evidence of relation to 9C.12.1. Investigacao recente nao reproduziu o problema; arquivos focados passaram; duas suites Web completas passaram; CI #51, #52 e #53 passou. Rebaixamento para P3 recomendado, ainda nao formalizado;
- W-001 -- P3: marca antiga permanece somente em fixtures `SMTP_FROM_NAME`, asserts negativos e contextos locais deliberados, sem impacto no runtime/template transacional;
- DOC-001 -- P3: cleanup documental remanescente, sem risco operacional imediato;
- observabilidade SMTP inicial foi integrada em `main`, mas ainda nao publicada em producao; dashboard e metricas agregadas seguem fora do escopo atual.

## Proxima Entrega

O proximo checkpoint recomendado e publicar a branch documental de GOV-001B por PR e validar CI, sem merge automatico. Deploy controlado do OBS-001 deve ser uma etapa operacional posterior e explicitamente autorizada.
