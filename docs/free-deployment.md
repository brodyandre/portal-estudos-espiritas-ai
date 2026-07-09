# Free Deployment

## Objetivo

Descrever a forma mais simples e coerente de publicar o projeto sem custo, respeitando a arquitetura atual: frontend estatico e backend local para demo.

## Estrategia recomendada

Para esta versao do projeto, a estrategia mais segura e:

- publicar apenas o frontend no GitHub Pages
- manter a API local para demonstracoes tecnicas
- aproveitar o fallback do frontend para funcionar mesmo sem backend publicado

Essa estrategia combina bem com portfolio porque reduz custo, simplifica manutencao e ainda mostra a experiencia principal do produto.

## O que continua fora do GitHub Pages

Nesta fase, o GitHub Pages publica apenas arquivos estaticos do frontend.

Continuam locais:

- backend em Express
- endpoints da assistencia
- integracao com IA
- Ollama

Essa separacao e intencional para manter a publicacao simples e sem secrets.

## Por que o frontend pode ser publicado sozinho

O frontend foi preparado para esse cenario:

- usa `HashRouter`
- o Vite ajusta o `base` automaticamente quando `GITHUB_PAGES=true`
- a camada de servicos usa fallback para mocks locais
- as paginas principais continuam utilizaveis sem API remota

Na pratica:

- a navegacao funciona no GitHub Pages
- grupos, materiais, resumos e progresso podem aparecer via mocks
- o assistente e as acoes do professor continuam em modo demonstrativo quando a API nao responde

## Fluxo recomendado para GitHub Pages

1. Rode `npm install`.
2. Rode `make pages-check`.
3. Confirme que a build do frontend foi gerada com sucesso.
4. Envie a branch `main`.
5. Deixe o workflow publicar `apps/web/dist`.

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

O frontend continua funcional mesmo se a API estiver offline, usando fallback e mocks locais.

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

Se quiser apenas o comando direto:

```bash
GITHUB_PAGES=true VITE_API_URL= npm run build:web
```

## Configuracao de ambiente para deploy estatico

Voce pode seguir dois caminhos.

### Caminho 1. Portfolio estatico puro

Nao configure `VITE_API_URL`.

Resultado:

- o frontend tenta a URL padrao local
- no ambiente publicado essa chamada falha
- a camada de servicos ativa o modo demonstrativo

Esse e o caminho mais simples para portfolio.

### Caminho 2. Frontend apontando para uma API externa

Configure `VITE_API_URL` no processo de build para apontar para uma API publicada.

Resultado:

- o frontend tenta primeiro a API remota
- se houver falha, ainda pode cair para mocks em varias telas

Esse caminho so vale a pena quando existir uma hospedagem separada para a API.

## Workflow de publicacao

O arquivo `.github/workflows/pages.yml` foi pensado para:

- instalar dependencias
- buildar apenas `apps/web`
- publicar `apps/web/dist`

O workflow:

- nao depende de backend
- nao depende de Ollama
- nao depende de secrets
- usa o fallback do frontend para manter a experiencia util no GitHub Pages

## Como publicar no GitHub Pages

1. Ative o GitHub Pages no repositorio com origem em `GitHub Actions`.
2. Confirme que o workflow `.github/workflows/pages.yml` esta na branch principal.
3. Envie um push para `main` ou execute o workflow manualmente.
4. Aguarde a publicacao do artefato estatico.

## O que fica online nesse modelo

### Fica online

- home
- portal compartilhavel
- painel do aluno em modo demonstrativo
- painel do professor em modo demonstrativo
- layout mobile-first
- mensagens de fallback

### Nao fica realmente publicado

- API Node local
- integracao real com Ollama
- persistencia real de perguntas
- estado compartilhado entre dispositivos

## Como demonstrar a API sem hospedar

Voce pode manter a API local e ainda mostrar a integracao de forma profissional:

- rode `npm run dev` durante uma gravacao
- faca uma demonstracao local com os endpoints ativos
- mostre no portfolio que o frontend tambem funciona sem backend

Isso comunica duas qualidades importantes:

- robustez de UX
- clareza de arquitetura

## Build e validacao antes de publicar

```bash
make pages-check
npm run preview
```

Revise:

- navegacao entre `/#/`, `/#/portal`, `/#/aluno` e `/#/professor`
- layout em 360px
- textos de fallback
- links internos e botoes principais

## Limites desta estrategia

- nao substitui um ambiente completo de producao
- nao publica a API
- nao mostra o modelo local rodando em tempo real no site estatico

Ainda assim, para portfolio, essa troca costuma ser boa: menos complexidade operacional e mais previsibilidade.

## Evolucao futura

Se o objetivo deixar de ser portfolio e passar a ser piloto real, o passo seguinte natural e:

- hospedar uma API separada
- adicionar persistencia
- definir autenticacao e autorizacao
- revisar governanca de conteudo

## Resumo

Para esta versao, o melhor deploy gratuito e o frontend no GitHub Pages com fallback local ativo. A API continua local para demo, e isso esta alinhado com o objetivo do projeto: mostrar produto, arquitetura e boas decisoes de engenharia sem inflar a complexidade operacional.
