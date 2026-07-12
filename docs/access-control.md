# Access Control

## Objetivo

Documentar como a aplicacao se organiza em quatro experiencias:

- Publico
- Aluno
- Professor
- Admin

Nesta fase, o projeto passa a usar autenticacao local simples no ambiente privado. Ainda assim, o GitHub Pages continua sem backend autenticado e deve ser tratado apenas como ambiente demonstrativo.

## Principio central

O GitHub Pages publica somente o frontend estatico. Isso significa:

- nao existe seguranca real no frontend publicado
- nao existe backend autenticado no GitHub Pages
- nao devem existir dados sensiveis expostos nesse ambiente
- o link real do Meet nao deve aparecer na versao publica

A seguranca real de producao ainda depende de uma futura camada hospedada e mais robusta. O que existe agora e suficiente para uso local controlado, nao para publicacao com dados reais.

## Experiencias da aplicacao

### 1. Publico

Experiencia aberta para visitantes, novos participantes e compartilhamento por QR Code.

Rotas publicas:

- `/`
- `/portal`
- `/educacao-continuada`
- `/inscricao`
- `/divulgacao`
- `/materiais`

Comportamento esperado:

- nao exige login
- nao mostra link real do Google Meet
- nao mostra dados reais de alunos
- nao mostra contatos reais de interessados
- pode usar mocks e mensagens demonstrativas
- pode orientar o visitante a registrar interesse

### 2. Aluno

Experiencia voltada para participantes aprovados.

Rotas implementadas no MVP:

- `/aluno`

Rotas planejadas para evolucao futura:

- `/aluno/materiais`
- `/aluno/assistente`
- `/aluno/progresso`

Comportamento esperado:

- visitante nao aprovado nao deve ver o link da aula
- aluno aprovado pode ver materiais e link do Meet
- no GitHub Pages, a experiencia pode existir apenas como demonstracao visual
- no modo local, a experiencia pode usar backend e aprovacao do professor
- no modo local, a rota `/aluno` exige login ou perfil demo quando o backend nao existir
- quando `mustChangePassword` estiver ativo no ambiente local, o aluno deve passar antes por `/primeiro-acesso`

### 3. Professor

Experiencia de preparacao de aulas e revisao de interessados.

Rotas implementadas no MVP:

- `/professor`

Rotas planejadas para evolucao futura:

- `/professor/interessados`
- `/professor/aulas`
- `/professor/revisao`

Comportamento esperado:

- professor revisa interessados
- professor organiza aula, materiais e rascunhos
- professor aprova ou marca para conversar
- professor revisa conteudos antes de publicar
- sem backend local, a experiencia continua apenas em modo demonstrativo
- com backend local, a rota `/professor` passa a respeitar login de `Professor` ou `Admin`

### 4. Admin

Experiencia administrativa mais ampla, separada do fluxo cotidiano do professor.

Rotas implementadas no MVP:

- `/admin`
- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/grupos`
- `/admin/conteudos`
- `/admin/configuracoes`
- `/admin/auditoria`

Comportamento esperado:

- admin gerencia usuarios
- admin gerencia grupos
- admin cuida de configuracoes
- admin acompanha trilha de auditoria
- no MVP atual, essa area ainda e conceitual e demonstrativa
- a operacao real dessa area depende de backend autenticado
- no ambiente local, a rota `/admin` passa a exigir login de `Admin`

## Regras de visibilidade

### Visitante

- ve apenas as rotas publicas
- nao ve link do Meet
- nao ve dados privados
- pode preencher inscricao
- nao autentica nas areas privadas locais

### Aluno aprovado

- pode acessar a area do aluno
- pode consultar materiais e progresso
- pode ver o link do Meet apenas no ambiente local autorizado
- no ambiente local, autentica pela rota `/login`
- quando aprovado localmente, recebe acesso temporario por comunicacao manual

### Professor

- pode revisar interessados
- pode revisar e preparar conteudos
- pode aprovar alunos
- ao aprovar, pode criar ou reativar o acesso local do aluno
- nao deve depender apenas do frontend publicado para operacao real
- no ambiente local, autentica pela rota `/login`

### Admin

- pode gerenciar usuarios, grupos e configuracoes
- pode acompanhar auditoria
- pode aprovar inscricoes e ativar acesso local quando necessario
- pode redefinir a senha de outros usuarios no ambiente local
- sofre limite de redefinicoes administrativas para evitar abuso e excesso de tentativas
- no ambiente local, autentica pela rota `/login`
- no MVP atual, a tela `/admin/usuarios` usa acoes simuladas e log mockado local
- no MVP atual, a tela `/admin/grupos` usa configuracao simulada e nunca expõe o Meet real no frontend publico

## GitHub Pages

No GitHub Pages:

- a aplicacao funciona como vitrine e demonstracao
- o frontend usa mocks e fallback local
- `/admin`, `/professor` e `/aluno` podem existir visualmente
- essas areas devem indicar modo demonstrativo quando nao houver API
- nenhuma dessas areas deve depender de dados reais sensiveis
- links reais do Google Meet continuam ocultos; apenas links demonstrativos ou avisos seguros podem aparecer
- `/login` continua apenas como apoio visual e troca segura de perfis demo

## Ambiente local

No ambiente local/private do owner:

- frontend roda localmente
- backend roda em `http://localhost:3333`
- login local usa JWT assinado por `JWT_SECRET`
- o primeiro acesso do aluno aprovado exige troca da senha temporaria
- endpoints de credenciais usam rate limiting em memória com `429` e `Retry-After`
- professor pode revisar interessados
- aluno aprovado pode acessar a area do aluno
- aprovacoes locais podem criar ou reativar acesso do aluno no PostgreSQL
- link real do Meet pode aparecer apenas para perfil autorizado
- dados reais devem ficar fora do GitHub Pages e fora do frontend publico
- gestao real de usuarios e auditoria administrativa exigem backend autenticado

## Limites do MVP atual

- com autenticacao local simples, mas ainda sem hardening de producao
- sem refresh token
- sem backend hospedado
- sem autorizacao fina por recurso
- sem auditoria real persistente
- sem troca forçada de senha para professores e admins criados manualmente, salvo quando configurado no backend

Esses limites sao aceitaveis nesta fase porque o foco ainda e demonstrar produto, UX e separacao basica de experiencias.

## Evolucao futura

Para uma versao de producao, o projeto deve evoluir para:

- autenticacao real por perfil
- autorizacao por rota e recurso
- backend hospedado
- persistencia segura
- auditoria real
- controle de acesso ao Meet no backend
