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
- painel do aluno com controle demonstrativo de acesso no navegador
- painel do professor em modo funcional
- paginas de materiais
- fallback local para grupos, materiais, perguntas frequentes e respostas demonstrativas

## O que continua local

Continuam fora do GitHub Pages:

- backend em Express
- endpoints da base de conhecimento
- assistente completo
- busca nos arquivos Markdown
- integracao com Ollama

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
- o assistente e as acoes do professor continuam em modo demonstrativo
- a area do aluno usa status local `visitor`, `pending` e `approved` apenas como protecao MVP
- o QR Code pode apontar para `/#/educacao-continuada` sem expor o Google Meet

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

## Com backend local

Quando voce quiser demonstrar a experiencia completa:

- rode a API local
- mantenha o frontend no navegador
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

## Resumo

Para esta versao, o melhor deploy gratuito e o frontend no GitHub Pages com fallback local ativo. A API, a busca real nos Markdown e o Ollama continuam locais para demo, sem aumentar a complexidade operacional.
