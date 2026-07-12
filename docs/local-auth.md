# Local Auth

## Objetivo

Documentar a autenticação local simples por perfil usando PostgreSQL, Prisma e JWT, sem alterar o papel do GitHub Pages como ambiente público e demonstrativo.

## Escopo desta etapa

Nesta fase:

- o login real funciona apenas localmente
- o backend em `http://localhost:3333` autentica `Admin`, `Professor` e `Aluno`
- o frontend publicado no GitHub Pages continua em modo demo
- o frontend público não expõe credenciais, tokens ou dados reais

## Variáveis de ambiente

Use no `.env` local:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5435/portal_estudos_espiritas_ai?schema=public
JWT_SECRET=jwt-secret-demo-local-only
```

O `.env` real continua fora do Git.

## Usuários demonstrativos da seed

Credenciais locais para desenvolvimento:

- `admin.demo@example.com` / `AdminDemo@123`
- `professor.demo@example.com` / `ProfessorDemo@123`
- `aluno.demo@example.com` / `AlunoDemo@123`

Essas credenciais existem apenas para ambiente local controlado.

## Endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`

## Regras principais

- usuário inexistente retorna erro seguro
- senha inválida retorna erro seguro
- usuário inativo não autentica
- `passwordHash` nunca retorna na resposta
- o token JWT é assinado com `JWT_SECRET`

## Proteção inicial

Nesta etapa:

- `GET /api/enrollments` exige `ADMIN` ou `TEACHER`
- `GET /api/enrollments/:id` exige `ADMIN` ou `TEACHER`
- `PATCH /api/enrollments/:id/status` exige `ADMIN` ou `TEACHER`
- `POST /api/enrollments` continua público para acolhimento de novos interessados

## Aprovação local de aluno

Quando `Admin` ou `Professor` aprova uma inscrição no ambiente local:

- o backend atualiza a inscrição
- o backend cria ou reativa o acesso local do aluno no PostgreSQL
- a resposta retorna `enrollment` e `studentAccess`
- `studentAccess` traz apenas `email`, `temporaryPassword` e `mustChangePassword`
- `passwordHash` nunca retorna
- o envio das credenciais continua manual no MVP

Campos extras do usuário local nesta fase:

- `enrollmentId`
- `temporaryPasswordGeneratedAt`
- `mustChangePassword`

## Fluxo no frontend

### GitHub Pages

- a rota `/login` existe, mas continua apenas demonstrativa
- o usuário pode alternar perfis demo com segurança
- o login real não acontece sem backend local

### Ambiente local

- a rota `/login` usa e-mail e senha reais da seed
- o token fica apenas no navegador local
- `/aluno`, `/professor` e `/admin` passam a respeitar autenticação local
- o Meet real continua restrito ao ambiente local autorizado
- após aprovar um interessado, o painel pode mostrar o acesso criado para cópia manual

## Limites atuais

- sem recuperação de senha
- sem cadastro público com senha
- sem OAuth
- sem expiração com refresh token
- sem backend hospedado

## Próximo passo natural

Depois desta etapa, a evolução recomendada é:

- proteger mais endpoints administrativos
- persistir usuários gerenciados pelo admin
- criar sessão mais robusta com renovação controlada
- separar melhor permissões por recurso
