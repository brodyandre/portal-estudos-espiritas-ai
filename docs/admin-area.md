# Admin Area

## Objetivo

Descrever a experiencia administrativa prevista para o projeto, separada do painel do professor.

Nesta fase, a area administrativa combina telas demonstrativas com fluxos locais autenticados. As rotas em `/admin` usam a autenticacao local e protecao por papel administrativo, mas a publicacao estatica no GitHub Pages continua sendo uma demonstracao sem seguranca real de producao.

## Papel da area administrativa

A area `Admin` existe para concentrar responsabilidades mais amplas que nao pertencem ao fluxo comum do professor.

Enquanto o professor cuida principalmente de:

- interessados
- aulas
- revisao de conteudos
- publicacao para a turma
- envio manual do acesso temporario quando uma aprovacao local cria credenciais de aluno

o admin cuida de:

- usuarios
- grupos
- configuracoes globais
- auditoria

## Rotas administrativas

Rotas previstas:

- `/admin`
- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/convites`
- `/admin/grupos`
- `/admin/conteudos`
- `/admin/configuracoes`
- `/admin/auditoria`

## Responsabilidades por rota

### `/admin`

Entrada geral da experiencia administrativa.

Pode resumir:

- situacao dos grupos
- pendencias
- acessos recentes
- avisos administrativos

### `/admin/dashboard`

Visao consolidada do sistema.

Pode reunir:

- total de grupos
- total de interessados
- total de aprovacoes
- pendencias de revisao
- estado do ambiente local

### `/admin/usuarios`

Gestao de perfis e acessos.

API implementada nesta etapa:

- `GET /api/admin/users`;
- `PATCH /api/admin/users/:userId/status`;
- exige autenticacao local;
- exige papel `admin`;
- retorna envelope padrao com `data.items` e metadados de paginacao em `meta`;
- aceita `page`, `pageSize`, `search`, `role`, `status`, `activationStatus`, `group`, `sortBy` e `sortOrder`;
- usa defaults `page=1`, `pageSize=10`, `sortBy=createdAt` e `sortOrder=desc`;
- busca por nome ou e-mail sem expor e-mail completo;
- ordena somente por `name`, `createdAt`, `role` e `status`, sempre com desempate por `id`;
- rejeita query desconhecida, repetida, array ou valor invalido com `INVALID_ADMIN_USER_LIST_QUERY`.

Contrato seguro da listagem:

- cada item contem somente `id`, `name`, `emailMasked`, `role`, `status`, `activationStatus`, `group` e `createdAt`;
- `emailMasked` preserva os dois primeiros caracteres do local-part, ou um quando houver apenas um, e acrescenta `***`;
- `status` e o status operacional persistido;
- `activationStatus` e derivado de `accountActivatedAt`, sem usar `mustChangePassword`;
- `group` usa `groupName` e `groupSlug`;
- se somente `groupName` ou somente `groupSlug` estiver persistido, a API retorna `group: null`;
- `lastLoginAt` fica deliberadamente ausente porque a listagem nao expõe dados de sessao;
- a resposta nao inclui e-mail completo, `passwordHash`, sessoes, convites, tokens, hashes, auditoria, inscricao completa ou observacoes administrativas.

Escopo atual entregue:

- pagina administrativa dedicada
- rota protegida para administradores
- listagem real de usuarios persistidos no PostgreSQL no modo local
- busca por nome ou e-mail
- filtro por papel
- filtro por status da conta
- filtro por estado de ativacao
- filtro por grupo
- filtros em modo draft
- botao explicito para aplicar filtros
- limpeza de filtros
- paginacao
- ordenacao
- loading
- estado vazio
- erro
- nova tentativa
- protecao contra respostas antigas
- protecao contra atualizacao depois da desmontagem
- e-mail mascarado
- acao visual `Alterar grupo` para usuarios ativos e inativos
- dialog acessivel para associar, substituir ou remover vinculo de grupo
- carregamento sob demanda apenas de grupos administrativos ativos
- opcao explicita `Sem grupo` sem enviar valor sentinela ao backend
- feedback local de sucesso e erro para alteracao de grupo
- refetch da listagem preservando filtros, ordenacao e paginacao apos a mutacao
- preservacao do status da conta ao alterar somente o vinculo de grupo
- modo demonstrativo do GitHub Pages com dados ficticios
- ausencia de fallback silencioso para mocks no modo local

Fora do escopo desta entrega:

- novas alteracoes no fluxo de ativacao ou inativacao; os controles ja existentes em `/admin/usuarios` permanecem disponiveis e inalterados
- alteracao de papel
- observacao administrativa
- detalhes administrativos expandidos
- auditoria na tela
- redefinicao de senha iniciada pela pagina nova
- outras mutacoes

Limite importante:

- essa tela usa autenticacao local simples, sem hardening de producao
- a operacao segura em producao exige backend hospedado, observabilidade e controles de acesso mais fortes
- o log demonstrativo atual nao substitui auditoria persistente de producao

Evolucoes futuras planejadas - ainda nao implementadas:

- ampliar o fluxo de ativacao e inativacao com novas regras, estados transientes adicionais e tratamento expandido de conflitos
- simulacao de alteracao de perfil, vinculo com grupo e observacao administrativa
- redefinicao de senha por admin em fluxo dedicado
- registro dessas acoes em um audit log demonstrativo local

Observacao de escopo backend atual:

- o backend local ja expoe `PATCH /api/admin/users/:userId/status` para alternar entre `active` e `inactive`;
- a mutacao revalida o admin ator dentro da propria transacao, revoga sessoes ao inativar e trata conflitos concorrentes;
- a pagina `/admin/usuarios` ja renderiza botoes de ativacao ou inativacao com confirmacao e feedback seguro;
- a mesma pagina permite vincular, substituir ou remover o grupo do usuario sem alterar o status da conta.

Regras previstas para futura redefinicao de senha:

- apenas admin pode executar a acao
- o proprio admin nao deve usar esse endpoint para redefinir a propria senha
- a senha temporaria aparece uma unica vez na interface
- sessoes anteriores do usuario sao encerradas
- o usuario deve trocar a senha no proximo acesso
- o endpoint possui limite de uso por admin e por usuario-alvo
- o limite por usuario-alvo e compartilhado entre administradores
- quando o limite e excedido, a interface deve orientar o admin a aguardar antes de tentar novamente

### `/admin/convites`

Gestao administrativa read-only da listagem de convites de conta, com acoes pontuais de cancelamento e reenvio.

Acesso:

- rota React em `/admin/convites`;
- no GitHub Pages, o `BrowserRouter` usa o subpath do preview como `basename` e mantém a rota interna `/admin/convites`;
- rota protegida pelo fluxo local de autenticacao;
- exige usuario com papel `admin`;
- professores, alunos e usuarios anonimos nao devem acessar a tela nem os endpoints administrativos.

Funcionalidades implementadas:

- listar convites vindos de `GET /api/admin/account-invitations`;
- paginar os resultados;
- buscar por destinatario;
- filtrar por estado de entrega, ciclo de vida e tipo do convite;
- ordenar por criacao, expiracao ou destinatario;
- escolher tamanho de pagina entre os limites aceitos pela API;
- exibir estado de carregamento, vazio, erro, retry manual e respostas tardias de forma segura;
- cancelar convite elegivel;
- reenviar convite elegivel;
- atualizar a listagem apos uma acao bem-sucedida sem retry automatico.

Estados de entrega exibidos:

- `sent`: e-mail enviado;
- `pending`: entrega pendente;
- `failed`: falha no envio;
- `not_configured`: e-mail nao configurado.

`failed` e `not_configured` indicam o resultado da tentativa de entrega. Eles nao significam, por si so, rollback da criacao do convite no reenvio administrativo.

Estados de ciclo de vida exibidos:

- `pending`: convite ainda utilizavel se nao expirou nem foi invalidado;
- `accepted`: convite aceito, sem acoes administrativas de cancelamento ou reenvio na interface;
- `expired`: convite expirado;
- `canceled`: convite invalidado administrativamente ou por substituicao.

Regras visuais de acao:

- `Cancelar` aparece apenas para convites com ciclo de vida `pending`;
- `Reenviar` aparece para convites que ainda nao foram aceitos;
- a API continua sendo a fonte de verdade e pode retornar `409` mesmo quando a interface mostrou uma acao disponivel;
- `ACCOUNT_INVITATION_NOT_CANCELABLE` e tratado como conflito seguro de cancelamento;
- `ACCOUNT_INVITATION_NOT_RESENDABLE` e tratado como conflito seguro de reenvio;
- `429` deve orientar aguardar antes de repetir a acao;
- `401` e `403` seguem o fluxo de autenticacao e autorizacao existente.

Cancelamento:

- usa `POST /api/admin/account-invitations/:invitationId/cancel`;
- envia corpo vazio;
- nao envia motivo livre no MVP;
- confirma a acao em modal antes de chamar a API;
- nao altera o estado de entrega original, apenas invalida o convite quando elegivel;
- nao expõe token, hash, URL, `userId`, e-mail completo ou dados internos.

Reenvio:

- usa `POST /api/admin/account-invitations/:invitationId/resend`;
- envia corpo vazio;
- confirma a acao em modal antes de chamar a API;
- cria um convite do tipo `admin_reinvite`;
- invalida o convite anterior elegivel e deixa somente o convite mais recente como utilizavel;
- tenta entrega por SMTP fora da transacao;
- a resposta publica contem apenas `expiresAt`, `deliveryStatus` e `invitationType`;
- mensagens de sucesso diferenciam `sent`, `pending`, `failed` e `not_configured` sem revelar URL ou token.

Seguranca da interface:

- a tabela usa `recipientEmailMasked`, nunca e-mail completo;
- a tela nao renderiza JWT, token bruto, `tokenHash`, URL de ativacao, `userId`, `invitedByUserId`, senha, IP, payload SMTP ou dados pessoais completos;
- erros tecnicos de rede e API sao normalizados para mensagens seguras;
- chamadas antigas da listagem sao ignoradas quando uma resposta mais recente ja foi iniciada;
- atualizacoes apos desmontagem sao bloqueadas.

Acessibilidade:

- a listagem usa titulo e regioes nomeadas;
- modais de confirmacao usam `role="dialog"`, `aria-modal="true"` e `aria-labelledby` apontando para o titulo visivel;
- o identificador acessivel interno do modal e estavel e nao contem `invitationId`, nome ou e-mail.

Testes de frontend cobrem:

- protecao da rota administrativa;
- estados de loading, vazio, erro, retry manual e paginação;
- filtros, busca e ordenacao;
- cancelamento, reenvio, conflitos `409` e limite `429`;
- concorrencia de acoes e ausencia de chamadas duplicadas;
- respostas tardias, desmontagem e ausencia de atualizacao indevida;
- sanitizacao de dados sensiveis;
- associacao acessivel dos modais por `aria-labelledby`.

### `/admin/grupos`

Gestao administrativa dos encontros dos grupos de estudo.

Acesso:

- rota React em `/admin/grupos`;
- no GitHub Pages, o `BrowserRouter` usa o subpath do preview como `basename` e mantém a rota interna `/admin/grupos`;
- rota protegida pelo fluxo local de autenticacao;
- exige usuario com papel `admin`;
- professores, alunos e usuarios anonimos nao devem acessar a tela nem os endpoints administrativos.

Finalidade da tela:

- selecionar um grupo administrativo pelo `slug`;
- listar encontros do grupo com paginacao;
- ordenar por data de inicio;
- incluir ou ocultar encontros cancelados;
- criar encontro futuro em grupo ativo;
- editar somente encontro futuro ainda nao iniciado;
- cancelar encontro futuro com motivo obrigatorio;
- preservar o historico de cancelamento sem exclusao fisica.

Consulta e filtros:

- o seletor de grupos usa a listagem administrativa de grupos como fonte de verdade;
- o `slug` do grupo selecionado e usado como `groupId` no contrato da API;
- a agenda usa `GET /api/admin/groups/:groupId/meetings`;
- os filtros permanecem em rascunho ate o admin acionar `Aplicar filtros`;
- `Limpar filtros` restaura `includeCanceled=false`, `sortOrder=asc`, `pageSize=10` e `page=1`;
- a paginacao preserva grupo, ordenacao, inclusao de cancelados e tamanho de pagina;
- se a pagina atual ficar invalida apos uma resposta da API, a tela corrige para a ultima pagina valida.

Estados exibidos:

- `Agendado`: encontro futuro e nao cancelado;
- `Em andamento`: horario atual igual ou posterior ao inicio e anterior ao termino;
- `Encerrado`: horario atual igual ou posterior ao termino;
- `Cancelado`: cancelamento registrado, com precedencia sobre os demais estados.

O status e derivado na interface a partir de `startsAt`, `endsAt` e `canceledAt`; ele nao e persistido no estado local nem enviado ao backend.

Criacao:

- disponivel apenas para grupo ativo;
- indisponivel no modo demonstrativo;
- exige titulo, inicio e termino;
- aceita descricao opcional;
- titulo recebe `trim` e tem limite de 120 caracteres;
- descricao recebe `trim`, tem limite de 320 caracteres e valor vazio e enviado como `null`;
- `startsAt` precisa estar no futuro;
- `endsAt` precisa ser posterior a `startsAt`;
- o formulario usa `input type="datetime-local"`, mas a tela converte para ISO com timezone explicito antes do envio.

Edicao:

- disponivel apenas para grupo ativo;
- disponivel apenas para encontro futuro com status derivado `Agendado`;
- indisponivel para encontros em andamento, encerrados ou cancelados;
- indisponivel no modo demonstrativo;
- o formulario e preenchido com os dados atuais;
- somente `title`, `description`, `startsAt` e `endsAt` podem ser enviados;
- campos imutaveis como `id`, `groupId`, `createdAt`, `updatedAt`, `canceledAt`, `cancellationReason` e status derivado nao sao enviados;
- submit sem mudanca real e bloqueado na interface, sem substituir a validacao final da API.

Cancelamento:

- disponivel apenas para encontro futuro com status derivado `Agendado`;
- continua disponivel mesmo se o grupo estiver inativo, conforme o contrato administrativo atual;
- indisponivel no modo demonstrativo;
- exige motivo obrigatorio;
- motivo recebe `trim`, nao pode ser vazio e tem limite de 320 caracteres;
- usa `POST /api/admin/groups/:groupId/meetings/:meetingId/cancel`;
- nao existe `DELETE` e o encontro nao e removido localmente antes do refetch.

Grupo inativo:

- a listagem continua disponivel;
- criacao fica indisponivel;
- edicao fica indisponivel;
- cancelamento de encontro futuro pode continuar disponivel;
- a tela exibe aviso explicito para diferenciar consulta de alteracoes administrativas.

Modo demonstrativo:

- mostra aviso de ambiente demonstrativo;
- lista grupos e encontros demonstrativos;
- preserva filtros, ordenacao e paginacao;
- nao exibe `Novo encontro`, `Editar` ou `Cancelar encontro`;
- nao abre dialogs de mutacao;
- nao executa chamadas de criacao, edicao ou cancelamento;
- os mocks de leitura nao mantem persistencia compartilhada entre acoes.

Atualizacao apos mutacoes:

- a tela nao faz atualizacao otimista;
- apos criacao, edicao ou cancelamento bem-sucedido, o dialog fecha, uma mensagem de sucesso e exibida e a agenda e consultada novamente;
- o refetch preserva grupo, filtros aplicados, ordenacao, tamanho de pagina e pagina atual quando ela continua valida;
- erros de rede mantem o formulario aberto para nova tentativa;
- limite de uso orienta o admin a aguardar antes de tentar novamente.

Datas e timezone:

- o valor de `datetime-local` representa horario local do navegador;
- antes de enviar ao backend, a tela converte o valor para ISO com timezone explicito por meio de `Date.toISOString()`;
- valores vindos da API sao convertidos para `datetime-local` considerando o timezone local do navegador;
- comparacoes de data usam timestamps, nao comparacao textual;
- datas invalidas, inicio no passado e termino anterior ou igual ao inicio sao rejeitados antes do envio.

Erros principais tratados na interface:

- sessao ausente ou expirada;
- falta de permissao;
- filtros ou campos invalidos;
- grupo ou encontro nao encontrado;
- grupo inativo para criacao ou edicao;
- encontro ja cancelado, iniciado ou encerrado;
- inicio no passado;
- ausencia de mudanca em edicao;
- conflito temporal entre encontros;
- limite administrativo de requisicoes;
- falha de rede.

Escopo excluido:

- alteracao do contrato da API;
- alteracao de Prisma;
- integracao com Google Calendar ou Google Meet;
- recorrencia;
- presenca ou frequencia;
- notificacoes;
- link de reuniao;
- exclusao fisica;
- calendario visual completo.

O contrato HTTP detalhado permanece documentado em `docs/api.md`.

### `/admin/conteudos`

Gestao editorial e organizacao dos materiais da base de conhecimento.

Escopo implementado:

- consome os endpoints persistentes de `/api/admin/knowledge`;
- lista, busca, filtra, ordena e pagina livros e documentos;
- cria e edita livros do catalogo editorial;
- cadastra documentos Markdown existentes por `filePath` relativo;
- edita metadados administrativos de documentos, sem alterar o Markdown;
- executa transicoes editoriais permitidas pelo backend;
- usa concorrencia otimista por `version`;
- mostra estados de carregamento, vazio, erro, rate limit e conflito;
- apresenta `fileExists` no detalhe do documento;
- substitui o fluxo demonstrativo anterior baseado em mock e `sessionStorage`.

Cuidados:

- a API e a interface nao editam Markdown diretamente;
- `filePath` identifica o documento persistente e nunca expõe caminho absoluto;
- status editorial nao filtra o RAG;
- temas sensiveis exigem `teacherReviewRecommended=true`;
- migration, seed e catalogacao continuam operacoes locais separadas;
- a interface nao executa `knowledge:catalog`;
- a base segue usando textos autorais e revisaveis, sem publicacao de PDFs.

### `/admin/configuracoes`

Configuracoes globais da aplicacao.

Escopo do MVP atual:

- definir nome da instituicao
- definir nome do portal
- ajustar URL publica do GitHub Pages
- ajustar URL recomendada para QR Code
- manter mensagem padrao de inscricao
- manter mensagem padrao de aprovacao
- manter mensagem padrao de WhatsApp
- escolher modo de publicacao entre demonstrativo, local e producao futura

Limites importantes:

- o salvamento atual fica apenas em mock ou estado local do navegador
- nao guarda segredos, tokens ou senhas
- configuracoes sensiveis devem migrar para backend autenticado em producao

### `/admin/auditoria`

Trilha de acompanhamento das acoes mais sensiveis.

Escopo do MVP atual:

- listar eventos mockados relevantes do fluxo
- mostrar data e hora
- mostrar ator
- mostrar perfil
- mostrar acao
- mostrar entidade relacionada
- mostrar observacao curta e segura

Eventos iniciais:

- aluno inscrito
- professor aprovou aluno
- acesso local de aluno criado ou atualizado
- professor marcou para conversar
- admin alterou grupo
- admin marcou conteudo como revisado
- admin alterou configuracao

Cuidados desta trilha:

- nao registrar dados sensiveis desnecessarios
- nao registrar conteudo de mensagens privadas
- em producao, a auditoria deve vir do backend autenticado

## Relacao entre Professor e Admin

### Professor

Foco no trabalho pedagogico e operacional do grupo:

- revisar interessados
- preparar aula
- revisar conteudos
- aprovar antes de publicar

### Admin

Foco em governanca e operacao do sistema:

- configurar estrutura geral
- manter usuarios e grupos
- acompanhar auditoria
- supervisionar regras gerais

## GitHub Pages

No GitHub Pages:

- a area administrativa pode existir como interface demonstrativa
- `/admin/convites` funciona no preview por meio do subpath e do `basename` do BrowserRouter
- nao deve usar dados reais
- nao deve mostrar informacoes sensiveis
- nao deve ser tratada como area segura

## Limites do GitHub Pages

Na experiencia `Admin` publicada:

- pode haver navegacao, mocks nao sensiveis e configuracoes demonstrativas
- nao pode haver dados reais de alunos
- nao pode haver WhatsApps reais
- nao pode haver e-mails reais
- nao pode haver tokens ou senhas
- nao pode haver PDFs
- nao pode haver links reais do Meet em paginas publicas
- nao pode haver qualquer segredo operacional

Isso vale inclusive para `/admin/usuarios`, `/admin/convites`, `/admin/grupos`, `/admin/conteudos`, `/admin/configuracoes` e `/admin/auditoria`.

## Ambiente local

No ambiente local:

- a area administrativa pode consumir a API local
- usa autenticacao local simples nesta fase
- serve apenas como MVP de operacao interna
- a tela `/admin/usuarios` consome a listagem administrativa real no modo local, permite mutacoes administrativas locais e usa dados ficticios no GitHub Pages
- a tela `/admin/convites` consome endpoints administrativos reais da API local e preserva respostas seguras
- a tela `/admin/grupos` pode revisar configuracoes do grupo e mostrar o Meet real apenas no ambiente local autorizado

## Decisao tecnica atual

Nesta fase do projeto:

- a experiencia `Admin` pode reutilizar partes da estrutura do painel do professor
- isso nao significa que professor e admin sejam o mesmo perfil
- a separacao conceitual de rotas ja deve existir na documentacao
- a tela de convites ja depende de autorizacao local por papel
- a separacao funcional completa de producao fica para a etapa com backend hospedado e controles persistentes

## Limites atuais

- sem hardening de login para producao
- sem autorizacao fina por recurso alem do papel local
- sem trilha de auditoria persistente
- sem segregacao forte entre professor e admin

## Evolucao futura recomendada

- autenticar admins e professores separadamente
- registrar acoes sensiveis no backend
- criar dashboards especificos por perfil
- controlar permissao por rota e recurso
- mover a gestao de usuarios e auditoria para endpoints protegidos
- mover a configuracao dos grupos e a entrega do link do Meet para endpoints protegidos

## Evolução para produção real

Uma versao de producao da area administrativa deve incluir:

- backend autenticado
- autorizacao forte por perfil administrativo
- auditoria persistente no backend
- configuracoes sensiveis fora do frontend
- integracao segura com grupos, usuarios e acessos
- entrega controlada de dados privados somente para pessoas autorizadas
