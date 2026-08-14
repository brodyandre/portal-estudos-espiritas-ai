# Access Control

## Objetivo

Documentar como a aplicacao se organiza em quatro experiencias:

- Publico
- Aluno
- Professor
- Admin

O projeto possui autenticacao via API para ambientes conectados. Ainda assim, o GitHub Pages continua sem backend autenticado proprio e deve ser tratado apenas como ambiente demonstrativo.

## Principio central

O GitHub Pages publica somente o frontend estatico. Isso significa:

- nao existe seguranca real no frontend publicado
- nao existe backend autenticado no GitHub Pages
- nao devem existir dados sensiveis expostos nesse ambiente
- o link real do Meet nao deve aparecer na versao publica

A producao oficial usa Web publica conectada a API hospedada e autenticada. O GitHub Pages permanece apenas como demonstracao estatica, sem dados reais sensiveis.

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
- aluno autenticado pode revisar suas sessoes em `/minha-conta/seguranca`
- no GitHub Pages, a experiencia pode existir apenas como demonstracao visual
- em ambiente conectado, a experiencia pode usar backend e aprovacao do professor
- em ambiente conectado, a rota `/aluno` exige login ou perfil demo quando o backend nao existir
- quando `mustChangePassword` estiver ativo, o aluno deve passar antes por `/primeiro-acesso`

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
- professor autenticado pode revisar suas sessoes em `/minha-conta/seguranca`
- sem backend disponivel, a experiencia continua apenas em modo demonstrativo
- com backend conectado, a rota `/professor` passa a respeitar login de `Professor` ou `Admin`

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
- admin autenticado pode revisar suas sessoes em `/minha-conta/seguranca`
- no GitHub Pages, essa area ainda e conceitual e demonstrativa
- a operacao real dessa area depende da API autenticada
- em ambiente conectado, a rota `/admin` passa a exigir login de `Admin`

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
- em ambiente conectado, autentica pela rota `/login`
- quando aprovado, recebe acesso por convite ou fluxo administrativo conforme configuracao do backend

### Professor

- pode revisar interessados
- pode revisar e preparar conteudos
- pode aprovar alunos
- ao aprovar, pode criar ou reativar o acesso local do aluno
- nao deve depender apenas do frontend publicado para operacao real
- em ambiente conectado, autentica pela rota `/login`

### Admin

- pode gerenciar usuarios, grupos e configuracoes
- pode acompanhar auditoria
- pode aprovar inscricoes e ativar acesso local quando necessario
- pode redefinir a senha de outros usuarios via endpoint administrativo protegido
- sofre limite de redefinicoes administrativas para evitar abuso e excesso de tentativas
- em ambiente conectado, autentica pela rota `/login`
- no GitHub Pages, a tela `/admin/usuarios` usa dados demonstrativos
- no GitHub Pages, a tela `/admin/grupos` usa configuracao demonstrativa e nunca expõe o Meet real no frontend publico

## GitHub Pages

No GitHub Pages:

- a aplicacao funciona como vitrine e demonstracao
- o frontend usa mocks e fallback local
- `/admin`, `/professor` e `/aluno` podem existir visualmente
- essas areas devem indicar modo demonstrativo quando nao houver API
- nenhuma dessas areas deve depender de dados reais sensiveis
- links reais do Google Meet continuam ocultos; apenas links demonstrativos ou avisos seguros podem aparecer
- `/login` continua apenas como apoio visual e troca segura de perfis demo

## Ambiente local e producao conectada

No ambiente local/private do owner:

- frontend roda localmente
- backend roda em `http://localhost:3333`
- login local usa JWT assinado por `JWT_SECRET`
- cada login cria uma sessao local individual que pode ser revogada depois
- o primeiro acesso do aluno aprovado usa um convite por e-mail para criar a própria senha
- a recuperacao de senha real funciona em ambiente com API e SMTP configurados
- endpoints de credenciais usam rate limiting em memória com `429` e `Retry-After`
- professor pode revisar interessados
- aluno aprovado pode acessar a area do aluno
- aprovacoes locais podem criar ou reativar acesso do aluno no PostgreSQL
- link real do Meet pode aparecer apenas para perfil autorizado
- dados reais devem ficar fora do GitHub Pages e fora do frontend publico
- gestao real de usuarios e auditoria administrativa exigem backend autenticado

Na producao oficial:

- Web: `https://portal-educacao-continuada.com.br`;
- API: `https://api.portal-educacao-continuada.com.br`;
- a API usa JWT, sessoes persistidas, papeis e PostgreSQL;
- recuperacao de senha transacional usa SMTP via Nodemailer/Resend;
- operacoes administrativas reais sao protegidas no backend.

## Limites do MVP atual

- GitHub Pages sem backend autenticado proprio
- sem refresh token
- sem autorizacao fina por recurso
- sem troca forçada de senha para professores e admins criados manualmente, salvo quando configurado no backend
- rate limits de credenciais em memoria do processo, adequados ao piloto em replica unica

Esses limites nao alteram a separacao entre GitHub Pages demonstrativo e producao oficial conectada.

## Evolucao futura

Evolucoes futuras ainda relevantes:

- autorizacao fina por recurso
- rate limit distribuido antes de escala horizontal
- controle mais granular de acesso ao Meet no backend
- hardening adicional de operacao e observabilidade
