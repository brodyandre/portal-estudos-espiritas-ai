# API

## Objetivo

API local em `Express + TypeScript` para servir dados demonstrativos e fluxos privados do portal de estudos espiritas, com respostas JSON padronizadas e persistencia local configuravel.

## Estrutura

```text
apps/api/
  src/
    app.ts
    server.ts
    config/
    data/
    lib/
    middleware/
    modules/
    routes/
  test/
```

## Scripts

Na raiz do projeto:

```bash
npm install
npm run dev
npm run build
npm run start
npm run test
```

### Atalhos uteis

```bash
npm run dev:api
npm run build:api
npm run start:api
npm run test:api
npm run typecheck
```

## Configuracao

Variaveis opcionais:

```bash
PORT=3333
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
OLLAMA_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

### CORS

- A API aceita por padrao origens locais como `localhost` e `127.0.0.1`.
- O objetivo e permitir o frontend local durante o desenvolvimento.

## Formato de resposta

### Sucesso

```json
{
  "success": true,
  "message": "Grupos de estudo carregados com sucesso.",
  "data": [],
  "meta": {
    "count": 2
  }
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "INVALID_GROUP_ID",
    "message": "Informe um groupId valido."
  }
}
```

### Erro de rate limit

```json
{
  "success": false,
  "error": {
    "code": "AUTH_RATE_LIMITED",
    "message": "Muitas tentativas. Aguarde antes de tentar novamente.",
    "details": {
      "retryAfterSeconds": 123
    }
  }
}
```

Quando aplicável, a API também envia o header `Retry-After`.

## Endpoints

### `GET /health`

Retorna o estado basico da API.

### `GET /api/studies`

Lista os grupos mockados com dados da proxima aula.

### `GET /api/studies/:slug`

Retorna um grupo especifico.

Slugs iniciais:

- `emmanuel`
- `a-caminho-da-luz`

### `GET /api/summaries`

Lista os resumos demonstrativos.

Query opcional:

- `groupId`

### `GET /api/questions`

Lista as duvidas demonstrativas.

Query opcionais:

- `groupId`
- `status`

### `POST /api/questions`

Cria uma nova duvida em memoria.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "lessonId": "lesson-emmanuel-2026-07-13",
  "authorName": "Maria",
  "question": "Como posso organizar melhor meu estudo na semana?",
  "visibility": "group"
}
```

Validacoes basicas:

- `groupId` obrigatorio e valido
- `lessonId` obrigatorio
- `authorName` com pelo menos 2 caracteres
- `question` com pelo menos 10 caracteres
- `visibility` deve ser `group` ou `teacher`

### `GET /api/materials`

Lista os materiais demonstrativos.

Query opcionais:

- `groupId`
- `type`

### `GET /api/progress`

Retorna progresso demonstrativo do aluno.

Query opcionais:

- `studentId`
- `groupId`

### `POST /api/auth/login`

Autentica `Admin`, `Professor` ou `Aluno` no ambiente local.

Body esperado:

```json
{
  "email": "aluno.demo@example.com",
  "password": "SenhaLocal@123"
}
```

Resposta de sucesso:

- `token`
- `user`

O objeto `user` pode incluir:

- `mustChangePassword`
- `passwordChangedAt`

Semântica:

- `passwordChangedAt` representa a última alteração de credencial
- esse campo muda tanto na troca de senha quanto em uma nova geração de senha temporária

Observacoes:

- `passwordHash` nunca retorna
- credenciais reais nao devem ser publicadas no frontend do GitHub Pages

Rate limit:

- 5 tentativas inválidas por combinação de IP + e-mail em 15 minutos
- ao exceder, retorna `429` com `AUTH_RATE_LIMITED`
- a chave usa e-mail normalizado apenas em memória interna
- login bem-sucedido limpa o contador dessa identidade

### `GET /api/admin/users`

Lista usuários para a área administrativa local.

Acesso:

- exige `Authorization: Bearer <token>`;
- exige usuário com papel `admin`;
- usuários sem sessão recebem `AUTH_REQUIRED`;
- usuários autenticados sem papel administrativo recebem `FORBIDDEN`;
- usuários com troca de senha obrigatória recebem `PASSWORD_CHANGE_REQUIRED` antes da listagem.

Query parameters aceitos:

- `page`: inteiro positivo, padrão `1`;
- `pageSize`: inteiro de `1` a `50`, padrão `10`;
- `search`: busca case-insensitive por nome ou e-mail persistido;
- `role`: um dos papéis reais (`visitor`, `student`, `teacher`, `admin`);
- `status`: um dos status reais (`pending`, `active`, `inactive`, `rejected`);
- `activationStatus`: `activated` ou `not_activated`;
- `group`: filtra por `groupSlug` normalizado;
- `sortBy`: `name`, `createdAt`, `role` ou `status`;
- `sortOrder`: `asc` ou `desc`, padrão `desc`.

Parâmetros desconhecidos, repetidos, arrays e valores fora da whitelist retornam `400` com `INVALID_ADMIN_USER_LIST_QUERY`.

Resposta:

```json
{
  "success": true,
  "message": "Usuários administrativos consultados com sucesso.",
  "data": {
    "items": [
      {
        "id": "user-id",
        "name": "Nome do usuário",
        "emailMasked": "lu***@exemplo.com",
        "role": "student",
        "status": "active",
        "activationStatus": "activated",
        "group": {
          "name": "Emmanuel",
          "slug": "emmanuel"
        },
        "createdAt": "2026-07-14T10:00:00.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

Segurança do contrato:

- `emailMasked` preserva somente os dois primeiros caracteres do local-part, ou um quando houver apenas um, e acrescenta `***`;
- o e-mail completo nunca é retornado;
- `activationStatus` deriva somente de `accountActivatedAt`;
- `status` representa o estado operacional persistido do usuário;
- `group` só é retornado quando `groupName` e `groupSlug` existem; grupos parciais retornam `null`;
- `lastLoginAt`, `passwordHash`, dados de sessão, convites, tokens, auditoria e observações administrativas não fazem parte da resposta.

### `PATCH /api/admin/users/:userId/status`

Atualiza o status operacional de um usuário pela área administrativa local.

Acesso:

- exige `Authorization: Bearer <token>`;
- exige usuário com papel `admin`;
- usuários sem sessão recebem `AUTH_REQUIRED`;
- usuários autenticados sem papel administrativo recebem `FORBIDDEN` na camada de rota;
- o service e a transação revalidam que o ator continua `admin`, `active` e com `accountActivatedAt` preenchido;
- usuários com troca de senha obrigatória recebem `PASSWORD_CHANGE_REQUIRED` antes da mutação.

Body esperado:

```json
{
  "status": "inactive"
}
```

Contratos de entrada:

- aceita somente um objeto JSON simples com a chave `status`;
- aceita somente `active` ou `inactive` em lowercase;
- rejeita body ausente, arrays, `null`, chaves extras e valores fora da whitelist com `400` e `INVALID_ADMIN_USER_STATUS_INPUT`;
- rejeita `userId` vazio, em branco ou acima de 160 caracteres com `400` e `INVALID_ADMIN_USER_STATUS_INPUT`.

Regras de negócio:

- permite apenas `active -> inactive` e `inactive -> active`;
- rejeita `active -> active` e `inactive -> inactive` com `409` e `ADMIN_USER_STATUS_ALREADY_SET`;
- rejeita qualquer tentativa envolvendo usuários em `pending` ou `rejected` com `409` e `ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED`;
- exige `accountActivatedAt` preenchido para `inactive -> active`, caso contrário retorna `409` e `ADMIN_USER_ACCOUNT_NOT_ACTIVATED`;
- bloqueia autoinativação administrativa com `409` e `ADMIN_USER_SELF_DEACTIVATION_NOT_ALLOWED`;
- preserva que sempre exista ao menos um admin autenticável pela combinação de revalidação do ator dentro da transação, bloqueio de autoinativação e retry serializable;
- quando a mudança é para `inactive`, revoga as sessões ativas do usuário na mesma transação;
- quando a mudança é para `active`, não restaura sessões antigas e `revokedSessions` permanece `0`;
- grava auditoria na mesma transação serializable;
- conflitos concorrentes retornam `409` e `ADMIN_USER_STATUS_CONFLICT`.

Rate limit:

- aplica limite por admin ator e por usuário alvo;
- quando excedido, retorna `429` com `ADMIN_USER_STATUS_RATE_LIMITED` e `Retry-After`.

Resposta de sucesso:

```json
{
  "success": true,
  "message": "Status do usuário atualizado com sucesso.",
  "data": {
    "user": {
      "id": "user-aluno-demo",
      "status": "inactive"
    },
    "revokedSessions": 2
  }
}
```

Sessão local:

- cada login cria uma sessão individual com `jti`
- o backend armazena apenas metadados da sessão
- o JWT completo nunca é persistido

### `GET /api/auth/me`

Retorna o usuario autenticado com base no token local.

### `GET /api/auth/sessions`

Lista as sessões do usuário autenticado.

Retorna apenas dados seguros:

- `id`
- `createdAt`
- `expiresAt`
- `lastSeenAt`
- `revokedAt`
- `isCurrent`
- `status`
- `device.label`
- `device.userAgentSummary`

Observações:

- não retorna JWT
- não retorna `ipHash`
- não retorna `userId`
- por padrão lista apenas sessões ativas
- aceita `includeInactive=true` para incluir revogadas ou expiradas

### `DELETE /api/auth/sessions/:sessionId`

Encerra uma sessão específica do próprio usuário.

Regras:

- exige token Bearer valido
- não permite encerrar a sessão atual por este endpoint
- ao tentar encerrar a sessão atual, retorna `CURRENT_SESSION_REVOCATION_NOT_ALLOWED`
- se a sessão não existir ou não pertencer ao usuário, retorna `404` com `AUTH_SESSION_NOT_FOUND`

### `POST /api/auth/logout`

Revoga apenas a sessão atual autenticada.

### `POST /api/auth/logout-others`

Revoga todas as outras sessões ativas do usuário autenticado, preservando a atual.

Resposta:

- `revokedSessions`

### `POST /api/auth/logout-all`

Revoga todas as sessões ativas do usuário autenticado, inclusive a atual.

Resposta:

- `revokedSessions`

### `PATCH /api/auth/change-password`

Troca a senha temporaria no primeiro acesso ou atualiza a senha local do usuario autenticado.

Body esperado:

```json
{
  "currentPassword": "SenhaTemporaria@123",
  "newPassword": "NovaSenha@123",
  "confirmPassword": "NovaSenha@123"
}
```

Regras:

- exige token Bearer valido
- valida a senha atual
- exige que `newPassword` e `confirmPassword` sejam iguais
- bloqueia reutilizacao da senha atual
- a nova senha deve ter pelo menos 8 caracteres, com letra maiuscula, letra minuscula e numero
- atualiza `mustChangePassword` para `false`
- atualiza `passwordChangedAt`
- revoga as sessões antigas
- cria uma nova sessão válida para o novo token
- nunca retorna `passwordHash`

Enquanto `mustChangePassword` estiver `true`, a API bloqueia as demais rotas autenticadas com:

```json
{
  "success": false,
  "error": {
    "code": "PASSWORD_CHANGE_REQUIRED",
    "message": "Troque sua senha temporária para continuar."
  }
}
```

Enquanto `mustChangePassword` estiver `true`, apenas estas rotas autenticadas continuam liberadas:

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PATCH /api/auth/change-password`

### `POST /api/auth/forgot-password`

Solicita a recuperação de acesso por e-mail, sem revelar se a conta existe.

Body esperado:

```json
{
  "email": "usuario@example.com"
}
```

Comportamento:

- normaliza o e-mail
- responde sempre com a mesma mensagem pública
- não informa existência, perfil ou status da conta
- para usuário elegível, gera token temporário de 30 minutos
- armazena apenas o hash do token
- invalida pedidos anteriores ainda ativos do mesmo usuário
- registra auditoria sem token bruto
- monta o link com `APP_PUBLIC_URL`
- tenta entregar o e-mail por SMTP quando `SMTP_ENABLED=true`
- se a entrega falhar, invalida o token recém-gerado e mantém a mesma resposta pública

Exemplo de resposta:

```json
{
  "success": true,
  "message": "Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.",
  "data": {
    "success": true,
    "message": "Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso."
  }
}
```

Rate limit:

- 5 solicitações por IP em 30 minutos
- 5 solicitações por identidade de e-mail normalizada em 30 minutos
- ao exceder, retorna `429` com `PASSWORD_RECOVERY_RATE_LIMITED`

Observações operacionais:

- em testes, o projeto usa notifier em memória
- no desenvolvimento local com Docker, o Mailpit fica disponível em `http://localhost:8025`
- exemplos de SMTP e Mailpit nesta documentação são demonstrativos e não carregam segredos reais

### `POST /api/auth/reset-password`

Redefine a senha por meio de token temporário de uso único.

Body esperado:

```json
{
  "token": "token-temporario",
  "newPassword": "NovaSenha@123",
  "confirmPassword": "NovaSenha@123"
}
```

Comportamento:

- valida o token de forma segura
- usa o mesmo padrão mínimo de senha do fluxo autenticado
- bloqueia reutilização da senha atual
- marca o token como usado
- invalida outros tokens ainda ativos do mesmo usuário
- define `mustChangePassword=false`
- atualiza `passwordChangedAt`
- limpa `temporaryPasswordGeneratedAt`
- revoga todas as sessões existentes do usuário
- não cria sessão automaticamente

Resposta:

```json
{
  "success": true,
  "message": "Senha redefinida com sucesso. Faça login novamente.",
  "data": {
    "success": true,
    "message": "Senha redefinida com sucesso. Faça login novamente."
  }
}
```

Erros estáveis:

- `INVALID_PASSWORD_RESET_TOKEN`
- `PASSWORD_CONFIRMATION_MISMATCH`
- `WEAK_PASSWORD`
- `PASSWORD_REUSE_NOT_ALLOWED`
- `PASSWORD_RESET_RATE_LIMITED`

### `POST /api/auth/accept-invitation`

Ativa o primeiro acesso do aluno por meio de um convite de uso único.

Body esperado:

```json
{
  "token": "convite-temporario",
  "password": "NovaSenha@123",
  "confirmPassword": "NovaSenha@123"
}
```

Comportamento:

- valida campos e confirmação
- aplica a mesma política mínima de senha do portal
- valida token ativo, não expirado e ainda não utilizado
- consome o convite de forma atômica
- grava apenas o hash da nova senha
- define `mustChangePassword=false`
- atualiza `passwordChangedAt`
- limpa `temporaryPasswordGeneratedAt`
- invalida outros convites ativos do mesmo usuário
- revoga sessões anteriores do usuário
- não cria sessão automaticamente

Resposta:

```json
{
  "success": true,
  "message": "Conta ativada com sucesso. Faça login para continuar.",
  "data": {
    "success": true,
    "message": "Conta ativada com sucesso. Faça login para continuar."
  }
}
```

Erros estáveis:

- `INVALID_ACCOUNT_INVITATION`
- `PASSWORD_CONFIRMATION_MISMATCH`
- `WEAK_PASSWORD`
- `ACCOUNT_INVITATION_RATE_LIMITED`

Rate limit:

- 5 tentativas inválidas por usuário em 15 minutos
- o foco é proteger erros de senha atual incorreta
- ao exceder, retorna `429` com `PASSWORD_CHANGE_RATE_LIMITED`
- sucesso na troca limpa o contador do usuário

### `POST /api/admin/users/:userId/reset-password`

Redefine administrativamente a senha de um usuário local e gera nova senha temporária.

Permissão:

- apenas `admin`

Comportamento:

- localiza o usuário pelo `userId`
- gera nova senha temporária forte
- grava apenas o hash
- define `mustChangePassword` como `true`
- atualiza `temporaryPasswordGeneratedAt`
- atualiza `passwordChangedAt` no mesmo instante da alteração da credencial
- invalida tokens anteriores
- mantém status, role e demais dados do usuário
- registra audit log sem senha nem hash
- retorna a senha temporária apenas uma vez

Exemplo de resposta:

```json
{
  "success": true,
  "message": "Senha temporária redefinida com sucesso.",
  "data": {
    "user": {
      "id": "user-aluno-demo",
      "fullName": "Aluno Demonstrativo",
      "email": "aluno.demo@example.com",
      "role": "student",
      "status": "active",
      "mustChangePassword": true,
      "temporaryPasswordGeneratedAt": "2026-07-12T15:00:00.000Z"
    },
    "temporaryPassword": "EXEMPLO@Senha123"
  }
}
```

Cuidados:

- a senha temporária deve ser entregue por canal seguro
- o endpoint não deve ser usado para auto-reset administrativo
- `passwordHash` nunca retorna

Rate limit:

- 10 redefinições por admin em 15 minutos
- limite adicional global para redefinições repetidas do mesmo usuário-alvo, mesmo com admins diferentes
- ao exceder, retorna `429` com `ADMIN_PASSWORD_RESET_RATE_LIMITED`
- quando bloqueado, o endpoint não expõe senha temporária

Observação operacional:

- nesta etapa, os contadores ficam apenas em memória
- ao reiniciar a API, o histórico de tentativas é perdido
- produção futura deve considerar Redis ou armazenamento distribuído

### `GET /api/admin/account-invitations`

Lista convites de conta para a interface administrativa `/admin/convites`.

Permissão:

- exige token Bearer valido;
- exige papel `admin`;
- retorna `401` com `AUTH_REQUIRED` sem autenticacao;
- retorna `403` para professor, aluno ou outro papel sem permissao.

Query params aceitos:

- `page`: inteiro maior ou igual a `1`; padrao `1`;
- `pageSize`: inteiro entre `1` e `50`; padrao `10`;
- `deliveryStatus`: `pending`, `sent`, `failed` ou `not_configured`;
- `lifecycleStatus`: `pending`, `accepted`, `expired` ou `canceled`;
- `invitationType`: `enrollment_approval` ou `admin_reinvite`;
- `search`: texto com ate 120 caracteres;
- `sortBy`: `createdAt`, `expiresAt` ou `recipient`;
- `sortOrder`: `asc` ou `desc`.

Queries repetidas, desconhecidas ou fora dos limites retornam `400` com `INVALID_ACCOUNT_INVITATION_LIST_QUERY`.

Resposta:

```json
{
  "success": true,
  "message": "Convites administrativos consultados com sucesso.",
  "data": {
    "items": [
      {
        "id": "account-invitation-demo",
        "recipientName": "Ana Beatriz",
        "recipientEmailMasked": "a***@example.com",
        "invitationType": "enrollment_approval",
        "deliveryStatus": "sent",
        "lifecycleStatus": "pending",
        "createdAt": "2026-07-13T12:00:00.000Z",
        "expiresAt": "2026-07-15T12:00:00.000Z",
        "deliveredAt": "2026-07-13T12:01:00.000Z",
        "deliveryFailedAt": null,
        "acceptedAt": null,
        "invalidatedAt": null,
        "invitedByName": "Admin Demonstrativo"
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

Campos publicos:

- `recipientEmailMasked` e o unico campo de e-mail retornado;
- `deliveryStatus` descreve a tentativa de entrega;
- `lifecycleStatus` descreve se o convite ainda esta pendente, aceito, expirado ou cancelado;
- `invitationType` diferencia convite gerado por aprovacao de inscricao e reenvio administrativo.

Nunca retorna:

- token bruto;
- `tokenHash`;
- URL de ativacao;
- JWT;
- `userId`;
- `invitedByUserId`;
- e-mail completo;
- senha ou `passwordHash`;
- IP;
- payload SMTP.

### `POST /api/admin/account-invitations/:invitationId/cancel`

Cancela um convite de conta elegivel.

Permissão:

- exige token Bearer valido;
- exige papel `admin`.

Body:

- pode ser ausente;
- pode ser objeto vazio `{}`;
- propriedades inesperadas retornam `400` com `INVALID_ACCOUNT_INVITATION_CANCEL_INPUT`.

Resposta:

```json
{
  "success": true,
  "message": "Convite cancelado com sucesso.",
  "data": {
    "canceled": true
  }
}
```

Erros contratuais relevantes:

- `INVALID_ACCOUNT_INVITATION_CANCEL_INPUT`: ID invalido ou body inesperado;
- `ACCOUNT_INVITATION_NOT_CANCELABLE`: convite inexistente, aceito, expirado, ja invalidado ou nao elegivel;
- `AUTH_REQUIRED`;
- `FORBIDDEN`.

Limite operacional:

- a API pode responder `429` com `ADMIN_INVITATION_CANCEL_RATE_LIMITED`;
- a resposta pode incluir orientacao de espera, como `Retry-After`;
- o frontend nao executa retry automatico;
- valores, janelas e politicas internas de limitacao podem evoluir sem alterar o objetivo funcional do endpoint.

Regras:

- a API e a fonte de verdade da elegibilidade;
- a interface pode mostrar o botao apenas para `lifecycleStatus=pending`, mas a API ainda pode retornar `409`;
- cancelar nao envia SMTP;
- a resposta nao inclui token, hash, URL, usuario interno ou e-mail completo.

### `POST /api/admin/account-invitations/:invitationId/resend`

Reenvia um convite de conta elegivel.

Permissão:

- exige token Bearer valido;
- exige papel `admin`.

Body:

- pode ser ausente;
- pode ser objeto vazio `{}`;
- propriedades inesperadas retornam `400` com `INVALID_ACCOUNT_INVITATION_RESEND_INPUT`.

Resposta:

```json
{
  "success": true,
  "message": "Reenvio de convite processado com sucesso.",
  "data": {
    "invitation": {
      "expiresAt": "2026-07-15T12:00:00.000Z",
      "deliveryStatus": "sent",
      "invitationType": "admin_reinvite"
    }
  }
}
```

Erros contratuais relevantes:

- `INVALID_ACCOUNT_INVITATION_RESEND_INPUT`: ID invalido ou body inesperado;
- `ACCOUNT_INVITATION_NOT_RESENDABLE`: convite inexistente, aceito, usuario ja ativado, usuario ausente, usuario inativo ou nao elegivel;
- `AUTH_REQUIRED`;
- `FORBIDDEN`.

Limite operacional:

- a API pode responder `429` com `ADMIN_INVITATION_RESEND_RATE_LIMITED`;
- a resposta pode incluir orientacao de espera, como `Retry-After`;
- o frontend nao executa retry automatico;
- valores, janelas e politicas internas de limitacao podem evoluir sem alterar o objetivo funcional do endpoint.

Regras:

- a API invalida o convite anterior elegivel e cria um novo `admin_reinvite`;
- somente o convite mais recente deve permanecer utilizavel para o usuario;
- a entrega SMTP ocorre fora da transacao;
- `sent` indica e-mail enviado;
- `pending` indica entrega ainda pendente;
- `failed` indica falha na tentativa de envio;
- `not_configured` indica SMTP nao configurado;
- `failed` e `not_configured` nao significam que a criacao do convite foi revertida;
- a resposta publica contem apenas `expiresAt`, `deliveryStatus` e `invitationType`;
- a auditoria nao deve conter token, hash ou URL.

### `POST /api/enrollments`

Recebe um cadastro simples de interesse vindo da pagina publica do portal.

Body esperado:

```json
{
  "fullName": "Bianca Ferreira",
  "email": "bianca.ferreira.demo@example.com",
  "whatsapp": "+55 00 90000-0099",
  "groupInterest": "Emmanuel",
  "alreadyParticipates": "Não",
  "message": "Gostaria de conhecer o grupo com tranquilidade."
}
```

Comportamento:

- valida os campos obrigatorios;
- cria um registro em memoria com status `pending`;
- nao expõe link do Google Meet;
- retorna a mensagem:
  `Sua solicitação foi recebida. Os professores revisarão seu cadastro.`

Validacoes basicas:

- `fullName` obrigatorio
- `email` obrigatorio e valido
- `whatsapp` obrigatorio
- `groupInterest` obrigatorio
- `message` opcional com limite de tamanho
- `teacherNote` opcional

Observacao:

- os exemplos de `whatsapp` nesta documentacao sao ficticios e existem apenas para demonstracao

### `GET /api/enrollments`

Lista os interessados para o painel do professor.

Query opcionais:

- `status`: `pending`, `approved`, `rejected`, `needs_contact`
- `groupInterest`: `Emmanuel`, `A Caminho da Luz`, `Ainda não sei`

Exemplo:

```text
/api/enrollments?status=approved
/api/enrollments?groupInterest=A%20Caminho%20da%20Luz
```

### `GET /api/enrollments/:id`

Retorna um cadastro especifico de interesse.

Se o item nao existir, a API devolve:

```json
{
  "success": false,
  "error": {
    "code": "ENROLLMENT_NOT_FOUND",
    "message": "Cadastro de interesse nao encontrado."
  }
}
```

### `PATCH /api/enrollments/:id/status`

Atualiza o status do cadastro depois da revisao do professor.

Body esperado:

```json
{
  "status": "approved",
  "teacherNote": "Aprovado para acompanhar o proximo encontro."
}
```

Status aceitos nesta etapa:

- `approved`
- `rejected`
- `needs_contact`

Comportamento:

- preenche `reviewedAt`
- define `reviewedBy` como `Professor`
- aceita `teacherNote` opcional
- nao expõe link do Meet

### `GET /api/knowledge`

Retorna uma visao geral curta da base de conhecimento, com total de arquivos publicos, grupos disponiveis e materiais compartilhados.

Observacoes:

- nao devolve conteudo integral dos arquivos;
- usa apenas resumo curto, titulo, tags e tipo;
- ignora arquivos de documentacao interna na listagem publica.

### `GET /api/knowledge/groups`

Lista os grupos disponiveis na base de conhecimento.

Grupos aceitos:

- `emmanuel`
- `a_caminho_da_luz`

### `GET /api/knowledge/:group`

Retorna os dados resumidos de um grupo especifico, com arquivos em destaque.

Grupos aceitos:

- `emmanuel`
- `a_caminho_da_luz`

Se o grupo nao existir, a API retorna `404` com erro amigavel:

```json
{
  "success": false,
  "error": {
    "code": "KNOWLEDGE_GROUP_NOT_FOUND",
    "message": "Grupo da base de conhecimento nao encontrado."
  }
}
```

### `GET /api/knowledge/:group/files`

Lista os arquivos publicos e resumidos de um grupo, sem expor conteudo longo.

Campos principais por item:

- `title`
- `filename`
- `type`
- `tags`
- `summary`
- `teacherReviewRecommended`

### `GET /api/knowledge/search?q=&group=`

Busca materiais curtos na base de conhecimento usando o retriever local por palavras-chave e similaridade simples.

Query esperada:

- `q`: obrigatoria, com pelo menos 2 caracteres
- `group`: opcional, aceita `emmanuel` ou `a_caminho_da_luz`

Exemplo:

```text
/api/knowledge/search?q=prece
/api/knowledge/search?q=capela&group=a_caminho_da_luz
```

Resposta esperada:

```json
{
  "success": true,
  "message": "Busca na base de conhecimento concluida com sucesso.",
  "data": {
    "query": "prece",
    "group": null,
    "items": [
      {
        "title": "Orientacoes do grupo",
        "filename": "orientacoes_do_grupo.md",
        "group": "Compartilhado",
        "book": "Base compartilhada",
        "type": "orientacoes",
        "tags": ["orientacoes", "convivio", "prece"],
        "summary": "Orientacoes curtas de convivio, participacao e uso responsavel do apoio ao estudo.",
        "teacherReviewRecommended": false,
        "sensitiveTopics": [],
        "score": 4.2,
        "source": "Base compartilhada · Orientacoes do grupo"
      }
    ],
    "guidance": "Resultados demonstrativos carregados com sucesso."
  },
  "meta": {
    "count": 1,
    "query": "prece",
    "group": null
  }
}
```

Se a busca nao encontrar contexto suficiente, a API responde com `success: true`, lista vazia e orientacao para levar a duvida ao professor.

### `POST /api/agent/lesson-plan`

Gera um roteiro inicial para a aula.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "theme": "Constancia no estudo durante a semana",
  "teacherNote": "Abrir com acolhimento breve.",
  "context": "Usar apenas conteudo demonstrativo autorizado.",
  "durationMinutes": 60
}
```

### `POST /api/agent/reflection-questions`

Gera perguntas de reflexao em linguagem simples.

Body esperado:

```json
{
  "groupId": "a-caminho-da-luz",
  "theme": "Convivio fraterno e responsabilidade",
  "context": "Foco em participacao respeitosa.",
  "questionCount": 5
}
```

### `POST /api/agent/summarize`

Gera um resumo inicial com base apenas no texto enviado.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "theme": "Leitura da semana",
  "sourceText": "Texto demonstrativo autorizado para resumo."
}
```

### `POST /api/agent/answer`

Gera uma resposta inicial curta com `LangGraph.js`, combinando contexto enviado na pergunta com busca simples nos arquivos Markdown autorizados.

Body esperado:

```json
{
  "groupId": "emmanuel",
  "question": "Como manter o estudo vivo durante a semana?",
  "context": "O grupo incentiva pequenos passos, leitura curta e duvidas honestas."
}
```

Resposta esperada:

```json
{
  "success": true,
  "message": "Resposta inicial gerada com sucesso.",
  "data": {
    "answer": "Resposta curta e revisavel.",
    "group": {
      "id": "emmanuel",
      "name": "Emmanuel",
      "bookTitle": "Emmanuel",
      "matchMode": "question_hint"
    },
    "sources": [
      {
        "source": "Contexto informado na pergunta",
        "title": "Contexto informado na pergunta",
        "score": 1
      },
      {
        "source": "Emmanuel · Emmanuel - constancia no estudo",
        "title": "Orientacoes do grupo",
        "score": 2.4
      }
    ],
    "keywords": ["constancia", "estudo", "semana"],
    "needsTeacherReview": true,
    "safetyNotes": [
      "Conteudo de apoio gerado para revisao humana. Revise com cuidado antes de publicar ou compartilhar."
    ],
    "suggestedTeacherFollowUp": "Se quiser aprofundar, vale levar esta pergunta ao professor com o trecho que mais chamou sua atencao.",
    "provider": "ollama",
    "usedFallback": false
  },
  "meta": {
    "provider": "ollama",
    "usedFallback": false
  }
}
```

Observacoes:

- O fluxo segue as etapas `receiveQuestion -> classifyStudyGroup -> retrieveContext -> checkContext -> generateAnswer -> applySafetyReview -> returnResponse`.
- O campo `group` mostra o foco mais provavel da resposta. Quando a pergunta nao aponta um livro com clareza, a busca pode considerar Emmanuel e A Caminho da Luz.
- O campo `keywords` resume palavras-chave uteis para leitura e revisao.
- O campo `suggestedTeacherFollowUp` indica como levar a duvida ao professor quando o tema pedir maior cuidado.
- Se o contexto ainda for insuficiente, a resposta orienta levar a duvida ao professor.
- A lista `sources` pode incluir o contexto enviado pelo proprio usuario, alem dos arquivos recuperados em `data/knowledge`.

### Fallback do modelo local

- Se o Ollama estiver indisponivel, a API responde com `success: true`, mas marca `usedFallback: true`.
- O campo `fallbackReason` explica por que o modo de contingencia foi usado.
- Toda resposta traz lembrete de revisao humana, sem autoridade doutrinaria e sem citacoes inventadas.

## Testes

Testes basicos implementados:

- `GET /health`
- `GET /api/studies`
- `GET /api/knowledge`
- `GET /api/knowledge/groups`
- `GET /api/knowledge/emmanuel`
- `GET /api/knowledge/a_caminho_da_luz`
- `GET /api/knowledge/search?q=prece`
- `GET /api/knowledge/search?q=capela`
- `POST /api/agent/lesson-plan`
- `POST /api/agent/answer`

## Observacoes

- Os dados usam apenas mocks locais em `apps/api/src/data`.
- O endpoint `POST /api/questions` grava em memoria apenas durante a execucao do processo.
- Os endpoints em `/api/knowledge/*` leem apenas a base local em `data/knowledge`, sem banco de dados.
- A listagem da base de conhecimento nunca devolve conteudo longo dos arquivos Markdown.
- O endpoint `GET /api/knowledge/search` reutiliza o retriever local ja usado pela resposta do assistente.
- Os endpoints em `/api/agent/*` usam `LangChain.js + Ollama` quando o modelo local estiver disponivel.
- O endpoint `POST /api/agent/answer` usa `LangGraph.js` para orquestrar pergunta, classificacao do grupo, busca local e revisao de seguranca.
- Quando o modelo local nao responde, a API usa um fallback simples e explicito para a demonstracao continuar.
- Nao ha banco, autenticacao ou persistencia nesta etapa.
