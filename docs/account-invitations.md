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
- atualiza o convite para `SENT` ou `FAILED`;
- não retorna token nem URL;
- não altera a senha de usuários existentes.

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
