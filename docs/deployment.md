# Deployment 9C

## Objetivo

Este documento descreve os artefatos neutros de container, build e operacao para o piloto publico do portal.

Dominios planejados:

- Web: `https://portal-educacao-continuada.com.br`
- API: `https://api.portal-educacao-continuada.com.br`

Esta documentacao nao escolhe provedor, nao configura DNS, nao provisiona banco, nao configura TLS e nao armazena secrets.

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

```bash
docker run --rm -d \
  --name portal-estudos-api-9c1 \
  --read-only \
  --tmpfs /tmp \
  -p 18080:4000 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e JWT_SECRET='<jwt-secret-ficticio-somente-smoke-local-nao-reutilizar>' \
  -e DATABASE_URL='postgresql://usuario_ficticio:senha_ficticia@127.0.0.1:65432/banco_indisponivel' \
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
- `OLLAMA_MODEL`
- `OLLAMA_BASE_URL`

Secrets reais devem ficar somente no ambiente do provedor ou secret manager. A imagem nao deve conter banco, JWT, senha SMTP, tokens ou chaves privadas.

## OLLAMA

A imagem da API nao inclui Ollama e nao inicia modelo local. `OLLAMA_MODEL` e `OLLAMA_BASE_URL` configuram um servico externo compativel. As rotas de agente usam fallback quando o modelo nao responde; a disponibilidade do modelo e decisao da 9C.3.

## Health e readiness

- `/health`: liveness simples, sem banco e sem corpus.
- `/ready`: readiness sanitizada, consulta PostgreSQL e estado operacional em memoria do corpus.

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

- Nenhum banco remoto provisionado.
- Nenhuma migration executada.
- Nenhum seed executado.
- Nenhum administrador criado.
- Nenhum SMTP real configurado.
- Nenhum DNS ou TLS configurado.
- Nenhum deploy executado.
- Nenhuma configuracao especifica de provedor.
