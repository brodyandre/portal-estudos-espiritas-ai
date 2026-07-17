# Convites de Conta

## Visão geral

O fluxo de convites de conta é usado quando uma inscrição é aprovada no ambiente local. Em vez de enviar senha por e-mail, o backend cria um convite de ativação com uso único e validade de 48 horas. O participante recebe um link para definir a própria senha no primeiro acesso.

## Arquitetura do fluxo

Ao aprovar uma inscrição, o backend executa na mesma transação:

- localiza e valida a inscrição;
- altera o status para `APPROVED`;
- cria ou atualiza o usuário relacionado;
- invalida convites anteriores ainda ativos;
- cria um novo `AccountInvitation`;
- registra os audit logs da aprovação e do convite.

Se qualquer etapa falhar, a transação é revertida. Assim, a inscrição não permanece aprovada sem convite persistido e um novo usuário também não fica salvo parcialmente.

## Usuário novo e usuário existente

- Usuário novo:
  - recebe um `passwordHash` aleatório e impossível de conhecer;
  - fica com `accountActivatedAt = null`;
  - fica com `temporaryPasswordGeneratedAt = null`;
  - fica com `mustChangePassword = false` até aceitar o convite.
- Usuário existente:
  - mantém a senha atual;
  - não tem a credencial substituída no reenvio administrativo;
  - recebe apenas um novo convite, quando necessário.

## Estados do convite

Os convites usam os estados:

- `PENDING`: convite persistido e aguardando tentativa de entrega;
- `SENT`: e-mail enviado com sucesso;
- `FAILED`: entrega falhou e o convite foi invalidado;
- `NOT_CONFIGURED`: fluxo sem entrega SMTP configurada, útil para cenários demonstrativos.

Na API e no frontend esses estados aparecem em minúsculas:

- `pending`;
- `sent`;
- `failed`;
- `not_configured`.

## Entrega SMTP fora da transação

O envio de e-mail nunca ocorre dentro da transação Prisma.

Depois que a transação é concluída:

1. o backend monta a URL apenas em memória, com o token bruto;
2. tenta enviar o e-mail;
3. se funcionar, marca o convite como `SENT` e preenche `deliveredAt`;
4. se falhar, marca como `FAILED`, preenche `deliveryFailedAt`, define `invalidatedAt` e registra auditoria segura.

Essa abordagem evita manter transações abertas durante integração com SMTP e impede rollback indevido da aprovação já persistida.

## Aceite do convite

O aceite usa atualização condicional para garantir atomicidade e uso único.

O backend só conclui a ativação quando encontra um convite que esteja:

- com `acceptedAt = null`;
- com `invalidatedAt = null`;
- com `expiresAt` ainda no futuro.

Quando a operação vence a concorrência:

- grava a nova senha em hash;
- define `accountActivatedAt`;
- define `passwordChangedAt`;
- mantém `mustChangePassword = false`;
- limpa `temporaryPasswordGeneratedAt`;
- invalida outros convites ativos do mesmo usuário;
- revoga sessões anteriores;
- registra auditoria.

## Bloqueio de login antes da ativação

Enquanto `accountActivatedAt` estiver `null`, o login local é bloqueado com resposta pública genérica:

- código compatível com `INVALID_CREDENTIALS`;
- mensagem: `E-mail ou senha inválidos.`

Isso evita revelar se a conta existe ou se está aguardando ativação.

## Reenvio administrativo

O reenvio administrativo:

- invalida o convite ativo anterior;
- cria um novo convite `PENDING` em transação;
- tenta enviar o e-mail fora da transação;
- atualiza o convite para `SENT`, `FAILED` ou `NOT_CONFIGURED`;
- não retorna token nem URL;
- não altera a senha de usuários existentes.

O resultado de entrega do reenvio administrativo deve ser interpretado assim:

- `sent`: o novo convite foi criado e o e-mail foi enviado;
- `pending`: o novo convite foi criado e ainda aguarda conclusão da entrega;
- `failed`: o novo convite foi criado, mas a tentativa de envio falhou;
- `not_configured`: o novo convite foi criado, mas SMTP não está configurado.

`failed` e `not_configured` não significam rollback automático da criação do convite no reenvio administrativo. O envio de SMTP permanece fora da transação para evitar transações abertas durante integração externa.

## Interface administrativa `/admin/convites`

A interface administrativa de convites fica em `/admin/convites`. Em publicação estática no GitHub Pages, o `BrowserRouter` usa o subpath do preview como `basename`, mantendo a rota interna `/admin/convites`.

A tela exige autenticação local e papel `admin`. Professores, alunos e acessos anônimos são bloqueados pelo fluxo de rotas protegidas e pelos endpoints administrativos.

Funcionalidades disponíveis:

- listagem paginada de convites;
- busca por destinatário;
- filtro por `deliveryStatus`;
- filtro por `lifecycleStatus`;
- filtro por `invitationType`;
- ordenação por `createdAt`, `expiresAt` ou `recipient`;
- escolha de tamanho de página dentro dos limites da API;
- retry manual em erro de carregamento;
- estado vazio sem exibir resumo incoerente de paginação;
- cancelamento de convite elegível;
- reenvio de convite elegível.

A tela não implementa edição livre, criação manual de convites, alteração de e-mail, alteração de usuário, filtros avançados fora da API, retry automático, cancelamento em lote ou reenvio em lote.

### Campos exibidos

A listagem usa apenas campos públicos:

- `id`, usado internamente para acionar cancelamento ou reenvio;
- `recipientName`;
- `recipientEmailMasked`;
- `invitationType`;
- `deliveryStatus`;
- `lifecycleStatus`;
- `createdAt`;
- `expiresAt`;
- `deliveredAt`;
- `deliveryFailedAt`;
- `acceptedAt`;
- `invalidatedAt`;
- `invitedByName`.

Não são renderizados:

- token bruto;
- `tokenHash`;
- URL de ativação;
- JWT;
- `userId`;
- `invitedByUserId`;
- e-mail completo;
- senha ou `passwordHash`;
- IP;
- payload SMTP.

### Cancelamento na interface

O botão `Cancelar` aparece apenas para convites com `lifecycleStatus=pending`. A confirmação usa modal antes de chamar `POST /api/admin/account-invitations/:invitationId/cancel`.

A API continua sendo a fonte de verdade. Se o convite deixou de ser cancelável entre a listagem e a confirmação, o frontend trata `ACCOUNT_INVITATION_NOT_CANCELABLE` como conflito seguro e não expõe detalhes internos.

### Reenvio na interface

O botão `Reenviar` aparece para convites que ainda não foram aceitos. A confirmação usa modal antes de chamar `POST /api/admin/account-invitations/:invitationId/resend`.

Após sucesso, a interface recarrega a listagem usando os filtros aplicados. A mensagem exibida depende do `deliveryStatus` retornado:

- `sent`: convite reenviado com sucesso;
- `pending`: reenvio processado e aguardando confirmação de entrega;
- `failed`: novo convite criado, mas o envio do e-mail falhou;
- `not_configured`: novo convite criado, mas o envio de e-mail não está configurado.

Se a API retornar `ACCOUNT_INVITATION_NOT_RESENDABLE`, a interface mostra um conflito seguro sem expor token, hash, URL ou dados internos.

### Concorrência e chamadas duplicadas

A interface bloqueia ações enquanto outra ação está em andamento, ignora respostas antigas de listagem e evita atualização de estado após desmontagem.

No backend, o reenvio administrativo invalida o convite substituído e mantém somente o convite mais recente como utilizável para o usuário. A auditoria deve registrar a operação sem token, hash ou URL.

### Acessibilidade

Os modais de confirmação usam `role="dialog"`, `aria-modal="true"` e `aria-labelledby` associado ao título visível. O ID acessível do título é estável e não contém `invitationId`, nome, e-mail ou outro dado dinâmico.

## Segurança e auditoria

O projeto não persiste nem registra:

- token bruto;
- `tokenHash` em logs;
- URL completa do convite;
- senha em texto puro;
- `passwordHash` nas respostas da API.

Os audit logs descrevem a operação de forma segura e resumida.

## Mailpit e ambiente local

Em desenvolvimento local, o fluxo pode usar Mailpit ou outro SMTP de testes. Isso facilita a revisão do convite sem depender de serviços externos.

## Limitações atuais

- o fluxo é pensado para ambiente local ou privado;
- o GitHub Pages continua em modo público e demonstrativo;
- produção real exigirá backend hospedado, autenticação endurecida e observabilidade adicional.
