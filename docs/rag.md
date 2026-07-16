# RAG Simples

## Objetivo

Implementar uma recuperacao inicial de contexto usando arquivos Markdown locais, sem banco vetorial nesta etapa.

## Fontes carregadas

O modulo de RAG trabalha com:

- `data/knowledge/emmanuel/*.md`
- `data/knowledge/a_caminho_da_luz/*.md`
- `data/knowledge/index.json`

Isso permite combinar conteudo curto com metadados prontos para busca e exibicao.

Nas Entregas 6A e 6B, o catalogo editorial persistente em PostgreSQL nao participa da recuperacao. O RAG permanece `filesystem-first`, lendo Markdown e `index.json`; estados editoriais como `draft`, `reviewed`, `approved` ou `archived` nao filtram consultas nesta etapa.

## Arquivos principais

```text
apps/api/src/rag/
  documentLoader.ts
  textSplitter.ts
  retriever.ts
  types.ts
  validateDocuments.ts
```

## O que e carregado de cada documento

Do frontmatter:

- `title`
- `group`
- `purpose`
- `source`

Do indice:

- `book`
- `filename`
- `path`
- `type`
- `tags`
- `description`
- `sensitiveTopics`
- `teacherReviewRecommended`

## Como o fluxo funciona

### 1. Loader

- localiza os arquivos Markdown nas pastas dos dois livros
- le frontmatter e conteudo
- cruza o arquivo com o `index.json`
- monta documentos com metadados consistentes

### 2. Splitter

- divide o texto em chunks curtos
- preserva contexto suficiente para resposta simples
- evita trechos longos demais
- mantem referencia ao arquivo original

### 3. Retriever

- normaliza a consulta
- expande algumas palavras-chave comuns
- calcula score por ocorrencia e sobreposicao textual
- aceita filtro opcional por `group` e `book`
- ordena os resultados mais uteis

## Busca e score

O score considera, de forma simples:

- ocorrencias no titulo
- ocorrencias nas tags
- ocorrencias na descricao
- ocorrencias no conteudo
- temas sensiveis relacionados
- semelhanca textual basica

Consultas como estas sao usadas nos testes e no uso manual:

- `prece`
- `constancia`
- `Capela`
- `Evangelho`
- `mediunidade`

## Resposta retornada pelo retriever

Cada resultado mantem campos legiveis para aluno e professor:

```ts
{
  source: string;
  title: string;
  content: string;
  score: number;
  group: string;
  book: string;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
}
```

O conteudo retornado deve permanecer curto. Se o contexto ficar fraco ou ambiguuo, o agente orienta levar a duvida ao professor.

As citacoes continuam referenciando os metadados e caminhos relativos vindos do loader de Markdown. A 6A nao altera o comportamento de citacoes nem consulta tabelas editoriais durante a resposta.

## Validacao dos documentos

Script disponivel:

```bash
npm run rag:validate
```

Ele verifica:

- se a pasta `data/knowledge` existe
- se ha arquivos Markdown
- se o frontmatter tem os campos obrigatorios
- se o conteudo nao esta vazio
- se o campo `source` indica material demonstrativo ou autoral

## Como testar localmente

1. Suba a API:

```bash
npm run dev:api
```

2. Rode os testes:

```bash
npm run test
```

3. Teste perguntas que ativem a recuperacao:

- `Como continuar estudando mesmo desanimado?`
- `A prece muda meus problemas?`
- `O que e Capela?`
- `Como entender racas adamicas com prudencia?`
- `Como viver o Evangelho na pratica?`

## Relacao com o frontend publicado

O GitHub Pages nao executa esse modulo. No ambiente publicado:

- o frontend continua funcional
- os materiais aparecem por fallback resumido
- a recuperacao real dos Markdown depende da API local

## Evolucao futura

- adicionar cache em memoria para documentos e chunks
- ampliar testes de recuperacao por livro e grupo
- trocar a busca simples por embeddings e vector database quando fizer sentido
- manter a mesma camada de metadados para facilitar a migracao
