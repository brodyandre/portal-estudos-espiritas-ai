# Free Deployment

## Objetivo

Descrever a forma mais simples e coerente de publicar o projeto sem custo, respeitando a arquitetura atual: frontend estatico e backend local para demo.

## Estrategia recomendada

Para esta versao, a estrategia mais segura e:

- publicar apenas o frontend no GitHub Pages
- manter a API local para demonstracoes tecnicas
- manter o Ollama rodando separado, apenas quando necessario
- aproveitar o fallback do frontend para funcionar mesmo sem backend publicado

## Livros e base de conhecimento

O projeto trabalha com dois conjuntos principais de materiais:

- `data/knowledge/emmanuel`
- `data/knowledge/a_caminho_da_luz`

Esses arquivos sao lidos pela API local. No GitHub Pages, o frontend usa um fallback resumido local e nao expoe o Markdown completo.

## O que fica no GitHub Pages

O GitHub Pages publica apenas arquivos estaticos do frontend.

Fica online:

- home
- portal compartilhavel
- pagina publica `/#/educacao-continuada`
- formulario `/#/inscricao`
- rotas publicas da experiencia `Publico`
- experiencia `Aluno` em modo demonstrativo
- experiencia `Professor` em modo demonstrativo
- experiencia `Admin` em modo demonstrativo
- paginas de materiais
- base de conhecimento autoral em formato resumido
- fallback local para grupos, materiais, perguntas frequentes e respostas demonstrativas
- mocks nao sensiveis necessarios para demonstracao

Regras do modo demo:

- nao mostrar link real do Google Meet
- nao usar dados reais sensiveis
- nao mostrar aprovacoes reais
- manter formularios e revisoes apenas em fluxo demonstrativo quando a API nao estiver disponivel
- nao tratar `/aluno`, `/professor` ou `/admin` como areas realmente seguras
- manter `/admin/configuracoes` apenas com dados publicos e mensagens demonstrativas

## Limites do GitHub Pages

O GitHub Pages nao deve publicar:

- dados reais de alunos
- WhatsApps reais
- e-mails reais
- tokens
- senhas
- PDFs das obras
- links reais do Meet em paginas publicas
- qualquer segredo

Mesmo quando a interface exibe areas de aluno, professor e admin, isso continua sendo uma representacao demonstrativa do produto.

## O que continua local

Continuam fora do GitHub Pages:

- backend em Express
- banco PostgreSQL local via Docker Compose
- acesso operacional real das experiencias `Aluno`, `Professor` e `Admin`
- endpoints da base de conhecimento
- assistente completo
- busca nos arquivos Markdown
- integracao com Ollama
- liberacao real da area do aluno
- exibicao do link real da aula para perfis autorizados
- seguranca real por autenticacao e autorizacao
- configuracoes sensiveis e operacionais de producao

Essa separacao evita secrets no frontend e simplifica a publicacao.

## Por que o frontend pode ser publicado sozinho

O frontend foi preparado para esse cenario:

- usa `HashRouter`
- o Vite ajusta o `base` quando `GITHUB_PAGES=true`
- a camada de servicos tolera ausencia de `VITE_API_URL`
- a interface usa mocks e fallback local quando a API nao responde

Na pratica:

- a navegacao funciona no GitHub Pages
- o usuario consegue ver grupos, materiais e resumos
- as experiencias `Aluno`, `Professor` e `Admin` continuam apenas como MVP visual e demonstrativo
- a area do aluno usa status local `visitor`, `pending` e `approved` apenas como protecao MVP
- o QR Code pode apontar para `/#/educacao-continuada` sem expor o Google Meet
- o frontend mostra mensagens claras avisando que dados reais e aprovacoes ficam apenas no ambiente local autorizado

## Como rodar localmente antes de publicar

```bash
npm install
npm run dev
```

Ou com Makefile:

```bash
make install
make dev
```

Nesse modo:

- frontend em `http://localhost:5173`
- API em `http://localhost:3333`
- experiencias `Professor` e `Admin` podem consumir o backend local
- aluno aprovado pode acessar a area privada do aluno

Variaveis uteis para o modo local/private:

```bash
VITE_APP_MODE=local
VITE_API_URL=http://localhost:3333
VITE_SHOW_REAL_MEET_LINK=true
VITE_ENABLE_ADMIN_FEATURES=true
VITE_ENABLE_TEACHER_FEATURES=true
```

Mesmo no modo local, o frontend nao deve armazenar segredos, tokens ou senhas. Esses dados devem ficar no backend quando a aplicacao evoluir para producao.

Nesta etapa, a persistencia local de inscricoes pode usar PostgreSQL com Prisma, mas isso continua restrito ao ambiente privado do owner.

Para subir so a API:

```bash
npm run dev:api
```

## Como testar perguntas localmente

Com a API ativa, voce pode testar o assistente:

```bash
curl -X POST http://localhost:3333/api/agent/answer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "O livro A Caminho da Luz e historico ou espiritual?",
    "group": "A Caminho da Luz"
  }'
```

Outros exemplos uteis:

- `Como continuar estudando mesmo desanimado?`
- `O que significa esforco proprio?`
- `Como entender Capela com prudencia?`
- `Como viver o Evangelho na pratica?`

## Como testar a build do GitHub Pages

Use:

```bash
make pages-check
```

Esse comando:

- ativa `GITHUB_PAGES=true`
- simula a base do repositorio
- nao depende de backend
- nao depende de Ollama
- nao depende de `VITE_API_URL`

## Como publicar no GitHub Pages

1. Rode `make pages-check`.
2. Confirme que o workflow `.github/workflows/pages.yml` esta na branch principal.
3. Ative o GitHub Pages com origem em `GitHub Actions`.
4. Envie um push para `main`.
5. Aguarde a publicacao de `apps/web/dist`.

## Sem backend publicado

Nesta fase, isso e esperado.

O frontend continua util porque:

- usa dados de fallback para grupos, materiais e progresso
- mostra respostas demonstrativas quando o backend nao esta disponivel
- nao depende de segredos nem de servicos externos para navegar
- usa um bloqueio local simples para evitar mostrar o link da aula a visitantes nao aprovados
- permite demonstrar inscricao, revisao e aprovacao em fluxo local simples
- preserva o limite entre a vitrine publica e o ambiente local autorizado

Isso vale especialmente para as rotas:

- publicas: `/#/`, `/#/portal`, `/#/educacao-continuada`, `/#/inscricao`, `/#/divulgacao`, `/#/materiais`
- aluno: `/#/aluno`
- professor: `/#/professor`
- admin: `/#/admin`

## Com backend local

Quando voce quiser demonstrar a experiencia completa:

- rode a API local
- mantenha o frontend no navegador
- use as rotas de professor para revisar interessados, aulas e revisoes
- use as rotas de admin para gestao interna demonstrativa
- use as rotas de aluno para testar acesso privado e materiais
- teste perguntas relacionadas aos dois livros
- use o Ollama apenas se quiser mostrar o fluxo completo do agente

## Direitos autorais e revisao humana

- os PDFs das obras nao devem ser versionados
- o frontend publicado nao deve expor os PDFs
- os materiais usados no projeto devem ser curtos e autorais
- respostas e rascunhos devem passar por revisao humana
- temas sensiveis pedem cuidado reforcado
- a aprovacao de novos alunos continua dependendo de revisao humana

## Limite atual do MVP

Mesmo com o frontend publicado:

- a autenticacao ainda nao e real
- a aprovacao do aluno pode ser apenas demonstrativa sem backend
- o Google Meet nao deve ser tratado como link publico
- a melhoria futura prevista e autenticacao real com controle de acesso mais robusto
- as rotas documentadas de aluno, professor e admin ainda nao representam seguranca forte
- a area administrativa completa depende de backend autenticado

## Evolução para produção real

Para uma versao de producao, a estrategia recomendada e:

- manter o frontend separado da API
- hospedar o backend em ambiente autenticado
- mover configuracoes, auditoria e aprovacoes reais para o backend
- entregar o link real do Meet apenas para perfis autorizados
- guardar secrets somente no backend ou no provedor de hospedagem
- manter a base autoral revisada e controlada editorialmente
- publicar no frontend apenas o que for seguro e necessario para a experiencia do usuario

## Resumo

Para esta versao, o melhor deploy gratuito e o frontend no GitHub Pages com fallback local ativo. A API, a busca real nos Markdown e o Ollama continuam locais para demo, sem aumentar a complexidade operacional.
