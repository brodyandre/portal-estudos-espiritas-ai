# Password Recovery

## Objetivo

Documentar o fluxo local de recuperação de senha com entrega transacional por SMTP, mantendo resposta pública genérica, testes isolados e desenvolvimento reproduzível.

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
6. A URL é montada com `APP_PUBLIC_URL`, sem ser salva no banco nem devolvida no endpoint público.
7. O notifier escolhido pela factory tenta entregar o e-mail:
   - `MemoryPasswordRecoveryNotifier` nos testes
   - `SmtpPasswordRecoveryNotifier` quando `SMTP_ENABLED=true`
   - `NullPasswordRecoveryNotifier` quando a entrega estiver desabilitada
8. Se o envio falhar, o token recém-gerado é invalidado de forma compensatória.
9. O usuário abre o link recebido e define uma nova senha em `/redefinir-senha`.
10. A redefinição revoga todas as sessões anteriores e exige novo login.

## Variáveis de ambiente

```env
APP_PUBLIC_URL=http://localhost:5173
PASSWORD_RECOVERY_PREVIEW_ENABLED=false
PASSWORD_RECOVERY_TTL_MINUTES=30
SMTP_ENABLED=false
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=Portal de Estudos Espiritas
SMTP_FROM_EMAIL=no-reply@example.local
```

Regras:

- `APP_PUBLIC_URL` deve ser absoluto e usar `http` ou `https`
- `SMTP_USER` e `SMTP_PASSWORD` devem ser informados juntos quando usados
- a configuração SMTP incompleta falha no bootstrap com mensagem segura
- a prévia local continua desativada automaticamente em produção
- em produção, use remetente válido e não `.local`

## Mailpit no ambiente local

O `docker-compose.yml` inclui Mailpit para desenvolvimento:

- SMTP local: `localhost:1025`
- interface web: `http://localhost:8025`
- serviço: `mailpit`

Como subir:

```bash
docker compose up -d postgres mailpit
```

Ou, se quiser a pilha completa:

```bash
docker compose up --build
```

Como testar:

1. Ligue a API local com `SMTP_ENABLED=true`.
2. Envie um `POST /api/auth/forgot-password`.
3. Abra `http://localhost:8025`.
4. Localize o e-mail de recuperação.
5. Use o link recebido para abrir `/redefinir-senha`.

Mailpit é apenas para desenvolvimento local e não deve ser usado em produção.

## Segurança aplicada

- token gerado com `randomBytes`
- hash do token com HMAC SHA-256
- token de uso único
- expiração curta
- sem token em logs
- sem token em storage do navegador
- sem token bruto em banco, resposta pública ou auditoria
- sem enumeração de contas na solicitação
- `mustChangePassword` volta para `false` após redefinição bem-sucedida
- falha de entrega invalida o token recém-gerado

## Observabilidade segura

Os logs operacionais do fluxo permitem apenas:

- início da tentativa de entrega
- conclusão da entrega
- falha do provedor
- identificador interno de correlação
- tipo do notifier

Não registrar:

- e-mail completo
- token
- URL de recuperação
- hash do token
- senha SMTP
- corpo completo da mensagem

## Rate limiting

- `POST /api/auth/forgot-password`: 5 solicitações por IP e por identidade de e-mail em 30 minutos
- `POST /api/auth/reset-password`: 5 tentativas por IP e por token protegido em 15 minutos

## Estratégia de falha

- a resposta pública continua idêntica com usuário existente, inexistente ou falha de SMTP
- o token é persistido antes da tentativa de envio
- se o notifier falhar ou não houver entrega disponível, o token recém-gerado é invalidado
- o cliente nunca recebe detalhes do provedor SMTP

## Limites atuais

- sem fila assíncrona
- sem armazenamento distribuído do rate limit
- sem backend hospedado
- sem provedor transacional externo configurado por padrão

## Próxima evolução natural

- trocar Mailpit por provedor SMTP real no ambiente privado
- mover observabilidade para ferramenta dedicada
- adicionar fila de entrega quando houver hospedagem do backend
