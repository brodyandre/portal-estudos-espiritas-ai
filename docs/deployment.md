# Deployment 9C

## Objetivo

Este documento descreve os artefatos neutros de container, build e operacao para o piloto publico do portal.

Dominios de producao:

- Web: `https://portal-educacao-continuada.com.br`
- API: `https://api.portal-educacao-continuada.com.br`

Esta documentacao descreve o estado operacional e os procedimentos seguros. Ela nao armazena secrets, nao substitui o provedor de configuracao e nao autoriza novas alteracoes de Render, DNS, TLS ou banco sem etapa explicita.

## Divisao da Entrega 9C

- 9C.1: artefatos neutros de container, build, runtime e smoke local.
- 9C.2: banco gerenciado, migration one-shot e bootstrap seguro do primeiro administrador.
- 9C.3: publicacao da API em uma unica replica.
- 9C.4: publicacao da Web, dominio apex, `www` e TLS.
- 9C.5: SMTP transacional, smoke tests finais e liberacao do piloto.

## Imagens da API

O Dockerfile da API fica em `apps/api/Dockerfile` e possui targets separados:

- `runtime`: executa a API compilada.
- `migration`: executa Prisma CLI para migration controlada.

Ambos usam Node.js 20 e `npm ci`. O build evita lifecycle implicito com `--ignore-scripts` e executa `prisma generate` explicitamente depois de copiar `apps/api/prisma` e `apps/api/scripts`.

### Runtime da API

Build local:

```bash
docker build \
  --file apps/api/Dockerfile \
  --target runtime \
  --tag portal-estudos-api:9c1-local \
  .
```

O runtime:

- inicia com `node dist/server.js`;
- executa como usuario `node`;
- usa `PORT` em runtime;
- expoe `4000` apenas como documentacao;
- inclui `node_modules` de producao;
- inclui Prisma Client gerado;
- inclui `data/knowledge`;
- nao inclui migrations, seed, TypeScript source ou dev server;
- nao executa migration, seed ou bootstrap administrativo no startup;
- registra logs em stdout/stderr;
- deve funcionar com filesystem read-only e `/tmp` em tmpfs.

Smoke local sem banco real:

Defina localmente `JWT_SECRET` e `DATABASE_URL` com valores ficticios de smoke antes de executar o container.

```bash
docker run --rm -d \
  --name portal-estudos-api-9c1 \
  --read-only \
  --tmpfs /tmp \
  -p 18080:4000 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e JWT_SECRET \
  -e DATABASE_URL \
  -e APP_PUBLIC_URL='https://portal-educacao-continuada.com.br' \
  -e CORS_ORIGINS='https://portal-educacao-continuada.com.br' \
  -e TRUST_PROXY_HOPS=1 \
  -e SMTP_ENABLED=false \
  -e PASSWORD_RECOVERY_PREVIEW_ENABLED=false \
  portal-estudos-api:9c1-local
```

Validacoes:

```bash
curl -fsS http://127.0.0.1:18080/health
curl -sS -o /tmp/ready-body -w '%{http_code}' http://127.0.0.1:18080/ready
docker logs portal-estudos-api-9c1
docker stop --time 15 portal-estudos-api-9c1
```

`/health` deve retornar 200. `/ready` deve retornar 503 quando o banco ficticio estiver indisponivel, sem expor `DATABASE_URL`, senha, stack trace ou host interno.

### Target de migration

Build local:

```bash
docker build \
  --file apps/api/Dockerfile \
  --target migration \
  --tag portal-estudos-api-migration:9c1-local \
  .
```

O target `migration`:

- contem Prisma CLI;
- contem Prisma Client;
- contem `apps/api/prisma/schema.prisma`;
- contem `apps/api/prisma/migrations`;
- contem `apps/api/scripts/run-prisma.mjs`;
- nao inicia servidor;
- nao executa migration durante `docker build`;
- recebe `DATABASE_URL` somente em runtime;
- deve ser usado como job one-shot.

Validacao segura sem banco:

```bash
docker run --rm \
  --entrypoint npm \
  portal-estudos-api-migration:9c1-local \
  --workspace @portal-estudos-espiritas-ai/api exec -- prisma --version
```

Execucao futura da migration, somente na 9C.2 ou posterior:

```bash
docker run --rm \
  -e DATABASE_URL='<postgresql-runtime-ou-direta-do-provedor>' \
  portal-estudos-api-migration:9c1-local
```

Quando o provedor oferecer URL pooled e URL direta, o runtime pode usar a pooled em `DATABASE_URL`, enquanto o job de migration pode receber temporariamente a URL direta tambem por `DATABASE_URL`. O codigo atual nao possui `DIRECT_URL` ou `MIGRATION_DATABASE_URL`.

## Seed proibido em producao

NAO EXECUTAR EM PRODUCAO:

```bash
npm --workspace @portal-estudos-espiritas-ai/api run prisma:seed
```

O seed atual e demonstrativo e destrutivo: apaga dados administrativos locais e cria usuarios e grupos de exemplo. Ele nao cria o primeiro administrador de producao com seguranca.

O bootstrap seguro do primeiro administrador e pendencia P0 da 9C.2.

## Bootstrap inicial seguro do administrador

O primeiro administrador de producao deve ser criado por um job one-shot depois das migrations e antes da liberacao operacional do piloto. Este fluxo nao usa rota HTTP, nao depende do seed demonstrativo e nao deve ser usado como criador geral de administradores.

Variaveis exigidas somente no momento do job:

- `DATABASE_URL`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`

O e-mail e normalizado com `trim` e lowercase. A senha segue a mesma politica do aplicativo: minimo de 8 caracteres, maximo de 128 caracteres, pelo menos uma letra maiuscula, uma letra minuscula e um numero. A validacao das variaveis de bootstrap acontece antes da criacao do cliente Prisma e antes de qualquer tentativa de banco.

Execucao via npm:

```bash
export DATABASE_URL
export BOOTSTRAP_ADMIN_EMAIL
export BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_NAME
npm --workspace @portal-estudos-espiritas-ai/api run admin:bootstrap
```

Execucao via container:

```bash
docker run --rm \
  -e DATABASE_URL='<postgresql-runtime-ou-direta-do-provedor>' \
  -e BOOTSTRAP_ADMIN_EMAIL \
  -e BOOTSTRAP_ADMIN_PASSWORD \
  -e BOOTSTRAP_ADMIN_NAME \
  --entrypoint npm \
  portal-estudos-api-migration:9c2a-local \
  --workspace @portal-estudos-espiritas-ai/api run admin:bootstrap
```

O bootstrap e idempotente apenas para o mesmo administrador ja existente quando ele e o unico usuario `ADMIN`. Se ja houver outro administrador, mais de um administrador, ou um usuario comum com o e-mail informado, o job termina em conflito controlado e nao promove usuarios existentes.

O usuario criado fica com `role=ADMIN`, `status=ACTIVE`, conta ativada e `mustChangePassword=true`. `passwordChangedAt` recebe o instante da criacao para representar a versao atual da credencial temporaria em tokens e sessoes; isso nao substitui a troca obrigatoria feita pelo usuario. A senha informada deve ser tratada como temporaria: apos o primeiro acesso em `/login`, o administrador deve troca-la via `PATCH /api/auth/change-password`. Depois da troca, remova `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` e `BOOTSTRAP_ADMIN_NAME` do ambiente, do secret manager ou da configuracao temporaria do job.

Em conflito serializavel `P2034`, o job tenta no maximo tres transacoes: a tentativa inicial e ate duas repeticoes. `P2002` e tratado como conflito operacional somente quando a constraint afetada e a de e-mail; outros erros Prisma sao falhas de banco sanitizadas.

Logs permitidos:

- `bootstrap_admin_started`
- `bootstrap_admin_created`
- `bootstrap_admin_already_initialized`
- `bootstrap_admin_conflict`
- `bootstrap_admin_failed`

Os logs usam e-mail mascarado e nao devem conter senha, hash, `DATABASE_URL`, objeto de usuario completo ou detalhes internos do erro.

Codigos de saida:

- `0`: administrador criado ou bootstrap ja inicializado com seguranca.
- `1`: variaveis ausentes ou invalidas.
- `2`: conflito de estado que exige avaliacao manual.
- `3`: erro de banco ou transacao.

## Imagem da Web

Build local com variaveis publicas explicitas:

```bash
docker build \
  --file apps/web/Dockerfile \
  --tag portal-estudos-web:9c1-local \
  --build-arg VITE_APP_MODE=local \
  --build-arg VITE_API_URL=https://api.portal-educacao-continuada.com.br \
  --build-arg VITE_ENABLE_ADMIN_FEATURES=true \
  --build-arg VITE_ENABLE_TEACHER_FEATURES=true \
  --build-arg VITE_SHOW_REAL_MEET_LINK=true \
  .
```

Esses build args sao publicos e ficam embutidos no bundle. Nao usar `VITE_JWT_SECRET`, `VITE_DATABASE_URL`, `VITE_SMTP_PASSWORD`, tokens ou credenciais no build da Web.

Runtime:

- usa Nginx Alpine;
- executa como usuario `nginx`;
- serve `/usr/share/nginx/html`;
- escuta porta `3000`;
- preserva fallback SPA com `try_files $uri $uri/ /index.html`;
- serve `robots.txt` e `sitemap.xml`;
- aplica cache longo a assets versionados;
- nao recebe secrets.

Smoke local:

```bash
docker run --rm -d \
  --name portal-estudos-web-9c1 \
  -p 18081:3000 \
  portal-estudos-web:9c1-local

curl -fsS http://127.0.0.1:18081/
curl -fsS http://127.0.0.1:18081/login
curl -fsS http://127.0.0.1:18081/admin
curl -fsS http://127.0.0.1:18081/materiais/emmanuel
curl -fsS http://127.0.0.1:18081/robots.txt
curl -fsS http://127.0.0.1:18081/sitemap.xml
docker stop portal-estudos-web-9c1
```

Rotas profundas devem receber o shell da SPA. Assets inexistentes em `/assets/` devem retornar 404.

## Variaveis da API

Runtime esperado:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_PUBLIC_URL`
- `CORS_ORIGINS`
- `TRUST_PROXY_HOPS`
- `SMTP_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- `PASSWORD_RECOVERY_TTL_MINUTES`
- `PASSWORD_RECOVERY_PREVIEW_ENABLED`
- `LLM_PROVIDER`
- `OLLAMA_MODEL`
- `OLLAMA_BASE_URL`
- `GROQ_API_KEY`
- `GROQ_MODEL`

Secrets reais devem ficar somente no ambiente do provedor ou secret manager. A imagem nao deve conter banco, JWT, senha SMTP, tokens ou chaves privadas.

### Metadata de revisão da API

A API expoe `GET /version` para retornar somente a revisao Git sanitizada do processo em execucao. Em runtime no Render, a fonte esperada e a metadata automatica `RENDER_GIT_COMMIT`, disponibilizada pelo provedor para o commit associado ao servico/deploy. A aplicacao valida esse valor antes de expo-lo e aceita apenas SHA Git hexadecimal completo de 40 caracteres, normalizado para lowercase.

Se `RENDER_GIT_COMMIT` estiver ausente, vazio ou invalido, `/version` continua respondendo HTTP 200 com `revision=unknown`. A ausencia dessa metadata nao impede startup, nao torna `/health` unhealthy e nao altera `/ready`.

`RENDER_GIT_COMMIT` nao e secret e nao precisa ser criado manualmente apenas para identificar o commit do deploy. O endpoint nao expoe `RENDER_GIT_BRANCH`, service id, instance id, hostname, `process.env`, banco, JWT, SMTP, chaves LLM ou outras configuracoes.

`/version` pode ser usado em validacoes operacionais para correlacionar a revisao live da API com o commit esperado em `main`. Ele nao prova, sozinho, que auto-deploy esta habilitado nem que todo merge foi automaticamente publicado; esses fatos dependem da configuracao operacional real do servico.

## SMTP transacional -- Resend

Resend e o provider SMTP transacional inicial de producao. A aplicacao continua usando SMTP padrao via Nodemailer; nao ha SDK Resend, API HTTP proprietaria, dependencia nova ou alteracao de runtime nesta decisao.

Estado validado da 9C.11:

- dominio de envio: `email.portal-educacao-continuada.com.br`;
- regiao Resend: Sao Paulo (`sa-east-1`);
- dominio Resend: `Verified`;
- Sending: habilitado;
- Receiving: desabilitado;
- DNS oficial do Resend aplicado no Registro.br para DKIM, Return-Path/SPF e SPF;
- DMARC adicional nao configurado nesta entrega;
- remetente: `Portal de Educação Continuada <no-reply@email.portal-educacao-continuada.com.br>`;
- credencial restrita `portal-production-smtp` criada com `Sending access` e restrita ao dominio aprovado;
- smoke real de recuperacao de senha aprovado com `Sent`, `Delivered`, recebimento, link HTTPS oficial, reset de senha e login com a nova senha.

Nao documentar valor de API key, `SMTP_PASSWORD`, tokens, senha, e-mail pessoal do smoke ou URL completa contendo token.

### Render e variaveis

Servico: `portal-estudos-api`.

| Variavel | Valor operacional | Classificacao | Observacao |
|---|---|---|---|
| `SMTP_ENABLED` | `true` | configuracao | SMTP transacional ativo em producao apos validacao controlada. |
| `SMTP_HOST` | `smtp.resend.com` | configuracao | Host SMTP do Resend. |
| `SMTP_PORT` | `2587` | configuracao | Porta STARTTLS usada no Render Free. |
| `SMTP_SECURE` | `false` | configuracao | STARTTLS via Nodemailer. |
| `SMTP_USER` | `resend` | sensivel/operacional | Usuario operacional do provider. |
| `SMTP_PASSWORD` | `<SECRET_RESEND_SMTP>` | secret | Credencial SMTP/API key; nunca versionar ou imprimir. |
| `SMTP_FROM_NAME` | `Portal de Educação Continuada` | configuracao | Nome institucional aprovado. |
| `SMTP_FROM_EMAIL` | `no-reply@email.portal-educacao-continuada.com.br` | sensivel/operacional | Remetente autorizado pelo dominio verificado. |
| `APP_PUBLIC_URL` | `https://portal-educacao-continuada.com.br` | configuracao | Origem publica usada nos links transacionais. |

No estado atual, Render Free bloqueia trafego SMTP de saida nas portas tradicionais `25`, `465` e `587`. O Resend documenta `2587` entre suas portas SMTP STARTTLS; por isso `SMTP_PORT=2587` com `SMTP_SECURE=false` foi adotado e validado no smoke real do piloto.

`Save only` pode ser usado para preparar variaveis no Render mantendo `SMTP_ENABLED=false`, mas nao deve ser tratado como ativacao nem como aplicacao da configuracao ao processo em execucao. Qualquer env criada ou alterada deve ser incorporada por deploy que aplique a configuracao salva, como `Save and deploy` ou operacao equivalente autorizada do servico da API.

`Restart service` nao substitui esse deploy quando houver env nova ou alterada ainda nao incorporada. Ele so deve ser citado em contextos sem alteracao de env pendente.

### DNS e remetente

O dominio de envio aprovado e `email.portal-educacao-continuada.com.br`.

- os valores SPF, DKIM e Return-Path/SPF aplicados vieram do painel oficial do Resend;
- nenhum valor longo de DKIM ou secret deve ser reproduzido neste repositorio;
- DMARC adicional nao foi adotado como requisito desta entrega;
- qualquer alteracao DNS futura exige autorizacao explicita;
- o remetente aprovado e permitido pelo dominio verificado.

### Sequencia operacional validada

Sequencia executada na 9C.11:

1. criar ou configurar Resend;
2. escolher dominio ou subdominio de envio;
3. cadastrar dominio;
4. obter DNS oficial no painel do Resend;
5. autorizar alteracao DNS;
6. publicar DNS;
7. validar dominio;
8. definir remetente;
9. criar credencial restrita;
10. configurar Render mantendo `SMTP_ENABLED=false` com `Save only`;
11. revisar env;
12. aplicar a configuracao preparada por `Save and deploy` ou deploy equivalente autorizado;
13. verificar `/health`;
14. verificar `/ready`;
15. ativar `SMTP_ENABLED=true`;
16. aplicar a ativacao por `Save and deploy` ou deploy equivalente autorizado;
17. verificar `/health`;
18. verificar `/ready`;
19. executar smoke autorizado;
20. verificar entrega;
21. auditar logs;
22. registrar resultado.

`/health` e `/ready` validam saude da aplicacao e readiness das dependencias ja cobertas pelo codigo. Eles nao validam entregabilidade SMTP. A entrega real exige smoke test autorizado conforme `docs/password-recovery.md`.

O transporte SMTP registra eventos operacionais sanitizados para sucesso e falha de envio transacional. Esses logs podem ser usados para confirmar `messageType`, resultado, duracao e categoria segura de erro, sem expor destinatario, token, URL completa, corpo da mensagem, credenciais, resposta bruta do provider ou erro bruto.

Para qualquer repeticao, rollback ou nova alteracao operacional, obter autorizacao explicita antes de alterar Render, Resend, DNS, Neon, banco ou enviar e-mail real.

### Rollback SMTP

Rollback operacional minimo:

- retornar `SMTP_ENABLED=false`;
- restaurar env anterior, se necessario;
- aplicar a env alterada por `Save and deploy` ou deploy equivalente autorizado;
- validar `/health`;
- validar `/ready`;
- observar logs sanitizados;
- nao expor credenciais.

O comportamento funcional e os limites da recuperacao de senha com SMTP desabilitado estao detalhados em `docs/password-recovery.md`.

### Achado readiness/Neon

Apos a ativacao SMTP, `/health` permaneceu saudavel, mas `/ready` apresentou temporariamente `status=not_ready`, `database.status=timeout` e `corpus.status=ready`. O codigo de readiness executa `SELECT 1` via Prisma com timeout curto por tentativa; se o banco nao responder apos as tentativas limitadas, retorna HTTP 503.

Durante a investigacao controlada, o Neon estava no plano Free; um `SELECT 1` manual no Neon concluiu com sucesso em aproximadamente 17 ms, o compute Primary apareceu Active e, imediatamente depois, `/ready` voltou a `status=ready`, `database.status=ok` e `corpus.status=ready`.

A evidencia sugere comportamento compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP. O hardening PILOT-01 adicionou retry curto e limitado na checagem de banco para reduzir falso negativo transitório. O achado nao bloqueia o piloto atual; ajuste adicional de timeout e observabilidade dedicada continuam sujeitos a entrega futura.

## Provider LLM

A API suporta `LLM_PROVIDER=ollama` e `LLM_PROVIDER=groq`.

Ollama continua indicado para desenvolvimento local. A imagem da API nao inclui Ollama e nao inicia modelo local. `OLLAMA_MODEL` e `OLLAMA_BASE_URL` configuram um servico externo compativel.

Groq e o provider remoto previsto para producao. Configure `LLM_PROVIDER=groq`, `GROQ_API_KEY` e `GROQ_MODEL` somente no ambiente backend do provedor. Nao use variavel `VITE_*` para a chave.

As rotas de agente usam fallback quando o provider configurado nao responde, excede timeout ou devolve conteudo vazio. Testes automatizados nao fazem chamadas reais ao Groq.

## Health e readiness

- `/health`: liveness simples, sem banco e sem corpus.
- `/ready`: readiness sanitizada, consulta PostgreSQL com retry curto e limitado e estado operacional em memoria do corpus.

Plataformas devem usar `/health` para healthcheck de container e `/ready` para liberacao de trafego quando banco estiver disponivel.

## Corpus

O corpus governado fica em `data/knowledge` e e copiado para a imagem da API. Ele deve ser lido em runtime pelo usuario nao root. O cache do corpus e em memoria e se perde no restart. A entrega assume uma unica replica.

## Comandos Makefile

```bash
make docker-build-api
make docker-build-api-migration
WEB_PUBLIC_APP_MODE=local \
WEB_PUBLIC_API_URL=https://api.portal-educacao-continuada.com.br \
WEB_PUBLIC_ENABLE_ADMIN_FEATURES=true \
WEB_PUBLIC_ENABLE_TEACHER_FEATURES=true \
WEB_PUBLIC_SHOW_REAL_MEET_LINK=true \
make docker-build-web
```

Esses comandos criam imagens locais e nao fazem push.

## Rollback

Rollback de aplicacao deve voltar para a imagem ou commit anterior. Rollback de banco exige backup antes da migration e avaliacao manual, especialmente para migrations irreversiveis.

## Limites desta etapa

- Nenhum secret deve ser versionado ou impresso.
- Nenhum DNS, Render, Resend, Neon ou banco deve ser alterado sem etapa operacional explicita.
- Nenhuma migration, seed ou bootstrap deve ser executado como parte de deploy documental.
- O piloto segue assumindo uma unica replica.
- Rate limits, locks e estado operacional em memoria devem ser reavaliados antes de escala horizontal.
