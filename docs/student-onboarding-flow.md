# Student Onboarding Flow

## Objetivo

Documentar o fluxo MVP de entrada de novos alunos a partir do QR Code de um cartaz ou convite publico.

Neste modelo:

- o QR Code nao leva direto ao Google Meet
- o visitante primeiro acessa uma pagina publica do portal
- o visitante registra interesse de forma simples
- o professor revisa o pedido no painel
- o acesso ao link do encontro aparece apenas para aluno aprovado

## Visao geral do fluxo

```text
Cartaz com QR Code
  -> pagina publica do portal
  -> formulario simples de interesse
  -> registro local ou via backend demo
  -> painel do professor para revisao
  -> status definido pelo professor
  -> aluno aprovado acessa a area do aluno
  -> Google Meet visivel apenas para aprovados
```

## Por que o Meet nao deve ficar publico

Deixar o link do Google Meet aberto em cartaz, QR Code ou pagina publica cria riscos desnecessarios:

- entrada de pessoas sem contexto do grupo
- compartilhamento indevido do link
- interrupcoes no encontro
- perda de organizacao do grupo
- dificuldade para acolher visitantes com mais cuidado

No MVP, a pagina publica continua aberta, mas o link do encontro deve ficar restrito a quem foi aprovado pelo professor.

## Fluxo do visitante

### 1. Escaneia o QR Code

O QR Code deve abrir uma pagina publica do portal, como uma rota de boas-vindas ou uma secao publica em `/portal`.

Essa pagina pode mostrar:

- nome do grupo
- dia e horario
- proposta simples do estudo
- aviso de que o encontro e acompanhado por professor
- botao para registrar interesse

### 2. Lê a explicacao publica

A pagina deve explicar, em linguagem acolhedora:

- que o portal apoia grupos de estudo
- que novos participantes podem demonstrar interesse
- que o professor revisa os pedidos antes de liberar o encontro
- que o Meet nao fica aberto publicamente

### 3. Preenche cadastro simples de interesse

O visitante informa apenas dados minimos e nao sensiveis.

Dados recomendados para o MVP:

- nome como prefere ser chamado
- primeiro nome ou nome curto
- cidade e estado, opcional
- WhatsApp ou email para contato
- grupo de interesse
- mensagem curta, opcional
- como conheceu o grupo, opcional

### 4. Recebe confirmacao simples

Depois do envio, a pagina informa algo como:

- `Recebemos seu interesse. O professor vai revisar e, se necessario, entrar em contato.`

Nao mostrar o link do Meet nesse momento.

### 5. Aguarda revisao

O visitante fica em estado inicial `pending`.

Se o projeto estiver rodando sem backend, esse envio pode ser apenas demonstrativo no frontend. Se o backend local estiver ativo, o registro pode ficar em memoria ou JSON, seguindo o padrao simples do projeto.

## Fluxo do professor

### 1. Abre o painel do professor

O professor visualiza uma lista de interessados por grupo.

Cada pedido pode mostrar:

- nome informado
- contato
- grupo de interesse
- mensagem curta
- data de envio
- status atual

### 2. Revisa o pedido

O professor analisa se:

- a pessoa parece ter interesse legitimo no grupo
- os dados minimos foram preenchidos
- vale aprovar direto ou conversar antes

### 3. Define um status

Status sugeridos para o MVP:

- `pending`: aguardando revisao
- `approved`: aprovado para acessar a area do aluno
- `rejected`: nao aprovado nesta etapa
- `needs_contact`: professor quer conversar antes

### 4. Aprova ou marca para conversar

Comportamento esperado:

- `approved`: visitante passa a ter acesso demonstrativo ao fluxo do aluno e ao link do Meet
- `needs_contact`: visitante ainda nao recebe acesso ao encontro; o professor combina conversa antes
- `rejected`: o pedido nao segue no fluxo

### 5. Mantem revisao humana

O professor continua como referencia principal. O sistema apenas organiza os pedidos e evita exposicao publica do encontro.

## Status do fluxo

### `pending`

- pedido recebido
- aguardando revisao
- sem acesso ao Meet

### `approved`

- pedido aceito
- acesso liberado para a area do aluno
- Meet visivel apenas nessa etapa

### `rejected`

- pedido nao aprovado
- sem acesso ao Meet
- no MVP, nao exige justificativa detalhada na interface

### `needs_contact`

- pedido pede conversa antes
- sem acesso ao Meet
- professor pode usar contato informado para acolher melhor

## Dados coletados no MVP

### Coletar

- nome como prefere ser chamado
- forma simples de contato
- grupo de interesse
- mensagem curta opcional
- cidade e estado opcionais

### Nao coletar

- documento
- endereco completo
- religiao
- idade exata
- informacoes intimas
- historico pessoal sensivel
- qualquer dado excessivo para um primeiro contato

## Cuidados de privacidade

- coletar apenas o minimo necessario
- explicar por que os dados estao sendo pedidos
- nao expor lista de interessados em pagina publica
- nao exibir contato de visitantes para outros alunos
- restringir o uso do dado ao acolhimento e organizacao do grupo
- evitar textos livres longos que incentivem relatos pessoais delicados

Mensagem simples recomendada:

`Use apenas dados basicos para contato. Se precisar conversar sobre algo delicado, o professor pode acolher isso depois com mais cuidado.`

## Compatibilidade com GitHub Pages

O frontend publicado no GitHub Pages deve continuar funcional.

Isso significa:

- a pagina publica do QR Code pode existir no frontend estatico
- o formulario pode funcionar em modo demonstrativo quando a API estiver offline
- o estado visual pode mostrar que o pedido foi recebido localmente
- sem backend, o fluxo nao representa liberacao real de acesso

No ambiente com backend local:

- os registros podem ser mantidos em memoria ou em arquivo JSON simples
- o professor pode revisar os pedidos no painel
- a aprovacao pode controlar a exibicao do Meet no fluxo demonstrativo

## Limitacoes do MVP

- sem login real
- sem autenticacao forte
- sem validacao formal de identidade
- sem notificacao automatica por email ou WhatsApp
- sem persistencia robusta para producao
- sem controle completo de sessao por visitante

Essas limitacoes sao aceitaveis nesta fase porque o foco e demonstrar fluxo, acolhimento inicial e protecao basica do link do encontro.

## Evolucao futura

Passos naturais para uma versao mais madura:

- login real para alunos aprovados
- convites com token temporario
- aprovacao com historico de revisao
- persistencia segura em banco de dados
- confirmacao de contato
- trilha de auditoria simples para mudancas de status
- politica clara de retencao e exclusao de dados

## Recomendacoes de UX

- manter a pagina publica acolhedora e objetiva
- usar botao claro como `Quero participar`
- explicar que o grupo sera revisado pelo professor antes de liberar o encontro
- evitar qualquer tom burocratico
- manter formularios curtos, confortaveis em `360px` e com labels claros

## Linguagem sugerida na interface

### Bons exemplos

- `Quero conhecer o grupo`
- `Registrar interesse`
- `Aguardando revisao`
- `Aprovado para o proximo passo`
- `Conversar antes de entrar`

### Evitar

- `Cadastro definitivo`
- `Triagem automatica`
- `Verificacao de identidade`
- `Acesso imediato ao encontro`

## Resumo

O fluxo de entrada por QR Code deve acolher o visitante sem abrir publicamente o Google Meet. O MVP recomendado e simples: pagina publica, formulario curto, revisao do professor, status claros e acesso ao encontro apenas para quem foi aprovado.
