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
- `PATCH /api/auth/change-password`

## Regras principais

- usuário inexistente retorna erro seguro
- senha inválida retorna erro seguro
- usuário inativo não autentica
- `passwordHash` nunca retorna na resposta
- o token JWT é assinado com `JWT_SECRET`
- no primeiro acesso do aluno aprovado, `mustChangePassword` exige troca da senha temporária
- a nova senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número
- `passwordChangedAt` representa a última alteração de credencial, incluindo troca de senha e redefinição de senha temporária

## Rate limiting local

Proteções atuais em memória:

- `POST /api/auth/login`: 5 tentativas inválidas por IP + e-mail em 15 minutos
- `PATCH /api/auth/change-password`: 5 tentativas inválidas por usuário em 15 minutos
- `POST /api/admin/users/:userId/reset-password`: 10 redefinições por admin em 15 minutos
- o reset administrativo também limita repetições globais para o mesmo usuário-alvo dentro da mesma janela

Comportamento:

- ao exceder o limite, a API responde com `429`
- os códigos estáveis são `AUTH_RATE_LIMITED`, `PASSWORD_CHANGE_RATE_LIMITED` e `ADMIN_PASSWORD_RESET_RATE_LIMITED`
- a resposta inclui `details.retryAfterSeconds`
- quando fizer sentido, a API também envia o header `Retry-After`
- os contadores vivem apenas em memória local e são perdidos ao reiniciar a API
- esta etapa não usa Redis; uma versão distribuída fica para produção futura

## Redefinição administrativa de senha

No ambiente local:

- apenas `Admin` pode redefinir a senha de outro usuário
- `Professor`, `Aluno` e `Visitante` não têm acesso a esse recurso
- o admin não usa esse endpoint para redefinir a própria senha
- a operação cria uma nova senha temporária forte
- `mustChangePassword` volta para `true`
- `temporaryPasswordGeneratedAt` e `passwordChangedAt` são atualizados no mesmo instante
- tokens anteriores deixam de valer imediatamente
- a senha temporária aparece uma única vez na resposta e não fica registrada em log
- a entrega da credencial deve ser feita por canal seguro

## Primeiro acesso do aluno

Fluxo local:

- o professor ou admin aprova a inscrição
- o backend cria ou reativa o usuário aluno com senha temporária
- toda nova senha temporária também atualiza `passwordChangedAt`
- o login local funciona com essa senha temporária
- enquanto `mustChangePassword` estiver `true`, o backend libera apenas:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PATCH /api/auth/change-password`
- após a troca de senha:
  - `mustChangePassword` passa para `false`
  - `passwordChangedAt` é atualizado
  - o frontend redireciona o aluno para a própria área
  - o token antigo deixa de ser aceito

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
- `passwordChangedAt`

## Fluxo no frontend

### GitHub Pages

- a rota `/login` existe, mas continua apenas demonstrativa
- o usuário pode alternar perfis demo com segurança
- o login real não acontece sem backend local

### Ambiente local

- a rota `/login` usa e-mail e senha reais da seed
- se o backend indicar `mustChangePassword`, o frontend redireciona para `/primeiro-acesso`
- a rota `/primeiro-acesso` exige a senha temporária atual, a nova senha e a confirmação
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
