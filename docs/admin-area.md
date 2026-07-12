# Admin Area

## Objetivo

Descrever a experiencia administrativa prevista para o projeto, separada do painel do professor.

Nesta fase, a area administrativa ainda e um conceito de MVP demonstrativo. A seguranca real dessa area depende de backend autenticado, ainda nao implementado.

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

Escopo do MVP atual:

- listar usuarios mockados ou vindos da API local
- filtrar por perfil e status
- mostrar nome, email, perfil, grupo, status e data de cadastro
- simular ativacao, inativacao, alteracao de perfil, vinculo com grupo e observacao administrativa
- permitir que um admin redefina a senha de outro usuario
- registrar essas acoes em um audit log mockado local

Limite importante:

- essa tela ainda nao tem autenticacao real
- a operacao segura em producao exige backend autenticado
- o log demonstrativo atual nao substitui auditoria persistente de producao

Regras da redefinicao de senha:

- apenas admin pode executar a acao
- o proprio admin nao deve usar esse endpoint para redefinir a propria senha
- a senha temporaria aparece uma unica vez na interface
- sessoes anteriores do usuario sao encerradas
- o usuario deve trocar a senha no proximo acesso
- o endpoint possui limite de uso por admin e por usuario-alvo
- o limite por usuario-alvo e compartilhado entre administradores
- quando o limite e excedido, a interface deve orientar o admin a aguardar antes de tentar novamente

### `/admin/grupos`

Gestao dos grupos de estudo.

Escopo do MVP atual:

- listar os grupos `Emmanuel` e `A Caminho da Luz`
- editar nome do grupo, livro base, professor responsavel, dia, horario e mensagem de boas-vindas
- ativar ou inativar grupo
- exibir o Google Meet com protecao por ambiente
- copiar mensagem de convite
- abrir uma visualizacao como aluno aprovado

Regras de exibicao do Meet:

- o link real nao deve aparecer em paginas publicas
- no GitHub Pages, a area admin usa link demonstrativo ou indicacao segura
- no ambiente local, o link real deve vir do backend ou da configuracao local autorizada
- em producao, a entrega segura do link depende de backend autenticado

### `/admin/conteudos`

Gestao editorial e organizacao dos materiais.

Escopo do MVP atual:

- listar arquivos resumidos da base `data/knowledge`
- filtrar por livro ou grupo
- filtrar por tipo de material
- visualizar titulo, grupo, tipo, tags, caminho e alerta de revisao humana
- marcar localmente como revisado
- marcar localmente como precisa revisao
- copiar o caminho do arquivo para apoio operacional

Cuidados desta tela:

- nao edita Markdown diretamente pela interface
- nao publica PDFs
- reforca que a base usa textos autorais e revisaveis
- temas sensiveis aparecem com destaque e pedem acompanhamento humano

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

Isso vale inclusive para `/admin/usuarios`, `/admin/grupos`, `/admin/conteudos`, `/admin/configuracoes` e `/admin/auditoria`.

## Ambiente local

No ambiente local:

- a area administrativa pode consumir a API local
- usa autenticacao local simples nesta fase
- serve apenas como MVP de operacao interna
- a tela `/admin/usuarios` pode simular a gestao de usuarios sem expor o link do Meet
- a tela `/admin/grupos` pode revisar configuracoes do grupo e mostrar o Meet real apenas no ambiente local autorizado

## Decisao tecnica atual

Nesta fase do projeto:

- a experiencia `Admin` pode reutilizar partes da estrutura do painel do professor
- isso nao significa que professor e admin sejam o mesmo perfil
- a separacao conceitual de rotas ja deve existir na documentacao
- a separacao funcional completa fica para a etapa com backend autenticado

## Limites atuais

- sem login real
- sem autorizacao real por perfil
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
