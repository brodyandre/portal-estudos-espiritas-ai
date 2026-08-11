# Estado Atual do Projeto

Baseline Git atual: `ebeb9143e042ea39e790ccb0e61efdca0a287a31`.

## Identificacao

Portal de Estudos Espiritas com IA, monorepo privado com API Express/TypeScript e Web React/Vite. O objetivo e apoiar grupos de estudo com areas publicas, aluno, professor e administracao, preservando revisao humana e governanca editorial.

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

## Limites Pos-Validacao

Achados nao bloqueantes registrados para evolucao futura:

- readiness: apos a ativacao SMTP, `/ready` apresentou temporariamente `database.status=timeout` com corpus `ready`; a evidencia sugere comportamento compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP;
- o timeout de 2 segundos do readiness de banco pode ser agressivo para wake-up e deve ser reavaliado com retry curto e observabilidade dedicada;
- rate limit de recuperacao/redefinicao usa memoria do processo, aceitavel para piloto em replica unica, mas inadequado como autoridade distribuida antes de escala horizontal;
- frontend ainda exibe textos de modo local/demo e credenciais demonstrativas em telas de autenticacao, achado de UX/apresentacao antes de exposicao mais ampla;
- o remetente real usa Portal de Educação Continuada, mas assunto/corpo do e-mail ainda usam Portal de Estudos Espíritas;
- a expiracao segue TTL funcional de 30 minutos, mas o template formata horario sem timezone institucional explicito.

## Proxima Entrega

A 9C.11 fica operacionalmente concluida apos a integracao desta documentacao. Novas entregas devem ser decididas separadamente a partir do backlog tecnico/UX pos-validacao.
