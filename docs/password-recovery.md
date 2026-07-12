# Password Recovery

## Objetivo

Documentar o fluxo local de recuperação de senha sem depender de SMTP, Redis ou serviços externos.

## Rotas públicas

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- frontend:
  - `/esqueci-minha-senha`
  - `/redefinir-senha`

## Como funciona

1. O usuário informa o e-mail em `/esqueci-minha-senha`.
2. A API responde sempre com a mesma mensagem pública.
3. Se a conta existir, o backend gera um token temporário com 30 minutos de validade.
4. O backend armazena apenas o hash do token.
5. Um novo pedido invalida tokens anteriores ainda ativos do mesmo usuário.
6. O usuário abre o link local de recuperação e define uma nova senha.
7. A redefinição revoga todas as sessões anteriores e exige novo login.

## Segurança aplicada

- token gerado com `randomBytes`
- hash do token com HMAC SHA-256
- token de uso único
- expiração curta
- sem token em logs
- sem token em storage do navegador
- sem enumeração de contas na solicitação
- `mustChangePassword` volta para `false` após redefinição bem-sucedida

## Entrega local

Nesta etapa, não existe provedor real de e-mail.

- testes usam notifier em memória
- desenvolvimento local pode usar prévia controlada quando `PASSWORD_RECOVERY_PREVIEW_ENABLED=true`
- o link de recuperação nunca aparece na resposta pública padrão

## Rate limiting

- `POST /api/auth/forgot-password`: 5 solicitações por IP e por identidade de e-mail em 30 minutos
- `POST /api/auth/reset-password`: 5 tentativas por IP e por token protegido em 15 minutos

## Limites atuais

- sem SMTP real
- sem fila de envio
- sem backend hospedado
- sem armazenamento distribuído do rate limit

## Próxima evolução natural

- integrar provedor transacional de e-mail
- mover rate limiting para armazenamento compartilhado
- adicionar observabilidade operacional para pedidos de recuperação
