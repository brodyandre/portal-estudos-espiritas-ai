# Password Recovery

## Objetivo

Documentar o fluxo de recuperação de senha com entrega transacional por SMTP, mantendo resposta pública genérica, testes isolados, desenvolvimento reproduzível e operação de produção validada.

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

## SMTP de produção com Resend

Resend é o provider SMTP transacional inicial de produção. A aplicação continua usando a arquitetura SMTP genérica já existente:

```text
Módulos de autenticação
↓
transactional-email
↓
Nodemailer
↓
SMTP padrão
↓
Resend
```

Estado validado da 9C.11:

- domínio de envio: `email.portal-educacao-continuada.com.br`;
- região Resend: São Paulo (`sa-east-1`);
- domínio Resend: `Verified`;
- Sending habilitado e Receiving desabilitado;
- DNS oficial do Resend aplicado no Registro.br para DKIM, Return-Path/SPF e SPF;
- DMARC adicional não foi requisito do piloto;
- remetente validado: `Portal de Educação Continuada <no-reply@email.portal-educacao-continuada.com.br>`;
- credencial restrita `portal-production-smtp`, com `Sending access` e restrição ao domínio aprovado, mantida fora do repositório;
- API `portal-estudos-api` configurada no Render com `SMTP_ENABLED=true`;
- smoke real controlado concluído com entrega, redefinição de senha e login.

Reply-To não está implementado atualmente e não é requisito do piloto. Mailbox humana para o remetente `no-reply` também não é pré-requisito do fluxo transacional atual.

### Variáveis de produção

| Variável | Produção validada | Observação |
|---|---|---|
| `SMTP_ENABLED` | `true` | SMTP transacional ativo em produção após validação controlada. |
| `SMTP_HOST` | `smtp.resend.com` | Host SMTP do Resend. |
| `SMTP_PORT` | `2587` | Porta STARTTLS validada no Render Free. |
| `SMTP_SECURE` | `false` | STARTTLS via Nodemailer. |
| `SMTP_USER` | `resend` | Valor operacional do provider, sem credencial. |
| `SMTP_PASSWORD` | `<SECRET_RESEND_SMTP>` | Secret operacional; nunca versionar, imprimir ou registrar. |
| `SMTP_FROM_NAME` | `Portal de Educação Continuada` | Nome institucional aprovado. |
| `SMTP_FROM_EMAIL` | `no-reply@email.portal-educacao-continuada.com.br` | Remetente autorizado pelo domínio verificado. |
| `APP_PUBLIC_URL` | `https://portal-educacao-continuada.com.br` | Base usada para montar `/redefinir-senha?token=...`. |

### Ativação operacional validada

Sequência executada na 9C.11:

1. criar ou configurar a conta Resend;
2. decidir o subdomínio de envio `email.portal-educacao-continuada.com.br`;
3. cadastrar o domínio no Resend;
4. obter os registros DNS oficiais no painel do Resend;
5. aplicar DNS somente com autorização explícita;
6. aguardar e validar a verificação do domínio;
7. definir o remetente institucional;
8. confirmar que o remetente é permitido pelo domínio verificado;
9. criar credencial SMTP restrita;
10. configurar Render sem expor secrets, inicialmente com `SMTP_ENABLED=false`;
11. aplicar a configuração preparada por deploy controlado;
12. validar `/health` e `/ready`;
13. ativar `SMTP_ENABLED=true`;
14. aplicar a ativação por `Save and deploy`;
15. validar novo deploy Live;
16. executar smoke real controlado.

A preparação pode usar `Save only` com `SMTP_ENABLED=false`, mas a configuração só deve ser tratada como aplicada após deploy controlado que incorpore as envs salvas, conforme `docs/deployment.md`. `Restart service` não substitui esse deploy quando houver env nova ou alterada pendente.

### Comportamento de falha em produção

Em produção, a prévia local fica indisponível. Se o envio SMTP não estiver disponível ou não concluir de forma segura, a resposta HTTP pública continua genérica para evitar enumeração de usuários, mas isso não confirma entrega real. O token recém-criado é invalidado conforme o comportamento atual quando não há entrega disponível ou quando o envio falha.

### Smoke test de produção

Foi executado exatamente um smoke real controlado na 9C.11.4:

1. usar uma conta controlada;
2. usar endereço de e-mail autorizado pelo proprietário do projeto;
3. disparar uma única solicitação inicial em `POST /api/auth/forgot-password`;
4. preservar resposta pública genérica anti-enumeração;
5. confirmar `Sent` e `Delivered` no Resend;
6. confirmar recebimento no endereço controlado;
7. confirmar remetente institucional correto;
8. confirmar HTML renderizado;
9. confirmar link para `https://portal-educacao-continuada.com.br/redefinir-senha?token=...`;
10. redefinir a senha uma única vez;
11. confirmar redirecionamento para `/login`;
12. confirmar login com a nova senha;
13. confirmar acesso autenticado à área `/aluno`.

Não foi executado teste manual de reutilização do mesmo token nesta etapa. O uso único, expiração, invalidação e revogação de sessões são comportamento implementado e coberto por testes automatizados.

Não registrar token, senha, credencial SMTP, API key, e-mail pessoal do smoke, URL completa com token ou corpo completo sensível.

### Rollback

Rollback mínimo:

1. retornar `SMTP_ENABLED=false`;
2. restaurar configuração anterior, se necessário;
3. aplicar a configuração alterada por deploy controlado;
4. validar `/health`;
5. validar `/ready`;
6. revisar logs sanitizados;
7. confirmar ausência de novas tentativas SMTP;
8. registrar o incidente sem secrets.

Com SMTP desabilitado em produção e sem prévia local, recuperação de senha não deve ser tratada como funcional. A resposta pública permanece protegida contra enumeração.

### Troubleshooting

- autenticação SMTP rejeitada: verificar `SMTP_USER`, `SMTP_PASSWORD`, escopo da credencial e status do provider;
- timeout, conexão recusada ou host incorreto: revisar `SMTP_HOST`, conectividade de saída e disponibilidade do provider;
- porta incorreta ou combinação porta/TLS incompatível: revisar `SMTP_PORT`, `SMTP_SECURE` e o uso de STARTTLS;
- domínio não verificado ou remetente não autorizado: validar domínio/remetente no Resend antes de ativar;
- SPF, DKIM ou DMARC pendente/incorreto: usar somente valores oficiais do Resend e política institucional autorizada;
- mensagem em spam: revisar domínio, remetente, reputação e conteúdo sem expor corpo sensível;
- provider indisponível ou rate limit do provider: manter resposta pública segura e observar logs sanitizados;
- rate limit da própria API: respeitar `Retry-After` e evitar repetição manual agressiva;
- `SMTP_ENABLED=false` ou variável ausente: revisar env e aplicar configuração alterada por deploy controlado quando aplicável;
- `APP_PUBLIC_URL` inválida: garantir origem HTTPS sem path, query, hash, usuário, senha ou localhost;
- alteração de env salva mas ainda não incorporada: executar deploy controlado antes de novo smoke;
- falha de entrega: não expor secret, token, URL completa ou payload SMTP.

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
- novo pedido invalida tokens anteriores ainda ativos
- redefinição bem-sucedida consome o token e revoga sessões anteriores

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
- API key
- corpo completo da mensagem

Limites atuais de observabilidade:

- sem dashboard SMTP dedicado;
- sem métricas próprias de taxa de entrega;
- sem integração dedicada com Resend para visão agregada de sucesso/falha;
- sem fila assíncrona de envio.

## Rate limiting

- `POST /api/auth/forgot-password`: 5 solicitações por IP e por identidade de e-mail em 30 minutos
- `POST /api/auth/reset-password`: 5 tentativas por IP e por token protegido em 15 minutos

O armazenamento atual é `MemorySlidingWindowRateLimiter`, em memória do processo. Isso é aceitável para o piloto atual em réplica única, mas não deve ser tratado como autoridade distribuída em escala horizontal. Antes de múltiplas réplicas, avaliar armazenamento distribuído como Redis.

## Estratégia de falha

- a resposta pública continua idêntica com usuário existente, inexistente ou falha de SMTP
- o token é persistido antes da tentativa de envio
- se o notifier falhar ou não houver entrega disponível, o token recém-gerado é invalidado
- o cliente nunca recebe detalhes do provedor SMTP

## Limites atuais

- sem fila assíncrona
- sem armazenamento distribuído do rate limit
- sem dashboard SMTP dedicado
- conteúdo textual do e-mail ainda usa Portal de Estudos Espíritas no assunto/corpo, enquanto o remetente validado usa Portal de Educação Continuada
- expiração funcional tem TTL de 30 minutos, mas o template ainda formata data/hora sem timezone institucional explícito
- frontend de produção ainda possui textos local/demo em telas de autenticação

## Próxima evolução natural

- mover observabilidade para ferramenta dedicada
- adicionar fila de entrega se o volume justificar
- alinhar identidade textual do e-mail ao remetente institucional
- explicitar timezone de expiração, preferencialmente alinhado à operação em São Paulo
- substituir rate limit em memória por armazenamento distribuído antes de escala horizontal
