# Local PostgreSQL

## Objetivo

Documentar a persistencia local do projeto com PostgreSQL para substituir gradualmente os mocks administrativos no backend, sem alterar o papel do GitHub Pages como ambiente publico e demonstrativo.

## Escopo desta etapa

Nesta fase:

- o PostgreSQL roda apenas localmente
- o banco sobe via Docker Compose
- o backend usa Prisma
- o backend autentica perfis locais com JWT
- o frontend publicado no GitHub Pages continua sem acesso ao banco
- o frontend continua com fallback demonstrativo quando a API nao estiver disponivel

## Porta local

Para evitar conflito com outras instalacoes locais:

- host: `5435`
- container: `5432`

## Variavel de ambiente

Use no `.env` local:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5435/portal_estudos_espiritas_ai?schema=public
```

O `.env` real nao deve ser versionado.

Os comandos do Prisma desta etapa leem esse `.env` na raiz do repositorio.

## Como subir o banco

Na raiz do projeto:

```bash
npm run db:up
```

Ou:

```bash
make db-up
```

Se quiser subir também o SMTP local de desenvolvimento:

```bash
docker compose up -d postgres mailpit
```

Mailpit fica disponível em:

- SMTP: `localhost:1025`
- interface web: `http://localhost:8025`

Se o comando `docker` nao existir no WSL, habilite a integracao da distribuicao no Docker Desktop antes de repetir o fluxo local.

## Como aplicar migration

```bash
npm run db:migrate
```

Ou:

```bash
make db-migrate
```

## Como carregar seed demonstrativo

```bash
npm run db:seed
```

Ou:

```bash
make db-seed
```

## Como abrir o Prisma Studio

```bash
npm run db:studio
```

Ou:

```bash
make db-studio
```

## Dados da seed

A seed atual usa apenas dados demonstrativos e seguros:

- e-mails `example.com`
- WhatsApps ficticios com `+55 00`
- links de Meet demonstrativos
- senhas demonstrativas para login local controlado
- nenhum dado real de aluno
- nenhum token, senha real ou segredo

## Modelos iniciais

Modelos criados no Prisma:

- `User`
- `Enrollment`
- `StudyGroup`
- `AuditLog`

Enums:

- `UserRole`
- `UserStatus`
- `EnrollmentStatus`
- `GroupStatus`

## O que continua publico

Mesmo com PostgreSQL local:

- GitHub Pages continua publicando apenas o frontend
- o frontend publicado nao acessa o banco
- mocks e fallback continuam ativos na interface publica

## O que passa a ficar local

- persistencia de inscricoes no backend
- trilha simples de auditoria para criacao e mudanca de status
- seed demonstrativo persistido em PostgreSQL
- autenticacao local de `Admin`, `Professor` e `Aluno`
- criacao ou reativacao de acesso de aluno ao aprovar inscricoes
- senha temporaria local retornada apenas no fluxo privado de aprovacao

## Proximo passo natural

Depois desta etapa, a evolucao recomendada e mover gradualmente outros fluxos administrativos para Prisma, mantendo sempre a separacao entre ambiente publico e ambiente local privado.
