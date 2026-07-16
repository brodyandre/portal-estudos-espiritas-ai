# RAG Simples

## Objetivo

Implementar uma recuperacao inicial de contexto usando arquivos Markdown locais, sem banco vetorial nesta etapa.

## Fontes carregadas

O modulo de RAG ainda mantem arquivos Markdown locais em:

- `data/knowledge/emmanuel/*.md`
- `data/knowledge/a_caminho_da_luz/*.md`
- `data/knowledge/index.json`

O `index.json` permanece util para catalogacao, validacao e usos legados, mas nao e autoridade dos fluxos publicos governados.

Nas Entregas 6A e 6B, o catalogo editorial persistente em PostgreSQL nao participa da recuperacao. O RAG permanece `filesystem-first`, lendo Markdown e `index.json`; estados editoriais como `draft`, `reviewed`, `approved` ou `archived` nao filtram consultas nesta etapa.

Na Entrega 7A foi adicionada uma fronteira interna para manifesto editorial seguro. Esse manifesto nasce do catalogo persistente, considera o catalogo a autoridade editorial e trata o filesystem apenas como armazenamento fisico. A politica minima para entrada no manifesto e:

- livro ativo;
- documento editorial aprovado;
- `filePath` relativo dentro de `data/knowledge`;
- arquivo Markdown existente, regular, legivel e sem escape por caminho absoluto, traversal ou symlink externo.

Falhas de catalogo ou de validacao nao abrem fallback para varrer todos os arquivos do filesystem. Quando nao houver fonte elegivel comprovada, o manifesto permanece vazio. O manifesto tambem possui fingerprint deterministico para permitir reconstrucao futura do corpus em memoria quando suas fontes mudarem.

Na Entrega 7B.1 foi adicionada a fronteira interna `governedCorpusService`. Ela transforma o manifesto editorial seguro em um snapshot imutavel de documentos autorizados, sem varrer diretorios livremente e sem usar `index.json` ou o loader legado como autoridade editorial. O manifesto continua governando inclusao, elegibilidade, fingerprint e resolucao segura de caminhos.

O corpus governado falha fechado: inconsistencias bloqueantes do manifesto, duplicidades, caminhos invalidos, arquivos autorizados ausentes, conteudo vazio, frontmatter invalido e falhas de leitura impedem a publicacao de snapshot parcial. O cache em memoria guarda somente o snapshot pronto atual, e sua validade depende da identidade composta por `manifestFingerprint` e `corpusFingerprint`.

O `manifestFingerprint` representa a identidade editorial: catalogo, publicacao, versao, titulos, tags, caminhos relativos autorizados e demais metadados do manifesto. Ele nao muda quando apenas o corpo Markdown muda.

O `corpusFingerprint` representa a identidade fisica: para cada fonte autorizada, o carregamento resolve o caminho governado, le o arquivo uma unica vez como bytes, calcula SHA-256 do `Buffer` lido e decodifica esse mesmo `Buffer` como UTF-8 para o parsing. Esses hashes sao agregados em ordem canonica com identificadores estaveis da fonte. Ele nao depende de caminho absoluto, `mtime`, tamanho isolado, ordem do filesystem, timestamps ou valores aleatorios.

Toda entrada usada para montar snapshot governado precisa trazer `contentHash` SHA-256 fisico valido em hexadecimal minusculo. Entradas sem hash, com hash vazio ou com formato invalido falham fechado; nao ha fallback para hash textual de `rawContent`.

Para descobrir o `corpusFingerprint` atual, o servico precisa ler e hashear as fontes autorizadas mesmo quando o cache sera reutilizado. Portanto, cache hit nao significa ausencia de leitura de filesystem; significa que o snapshot pronto e o retriever nao sao republicados nem reconstruidos quando a chave composta permanece igual. Nao ha watcher de filesystem. Quando o conteudo fisico muda sem mudanca editorial, a chave composta muda, o snapshot anterior nao e usado pelos fluxos publicos e a reconstrucao precisa concluir com sucesso antes da nova publicacao.

Chamadas simultaneas para o mesmo `manifestFingerprint` compartilham a construcao em andamento. A promise e removida ao final da tentativa, inclusive em falha, permitindo nova tentativa posterior. O cache e local ao processo da API e nao coordena multiplas instancias.

Na Entrega 7B.2, os fluxos publicos passam a depender obrigatoriamente do corpus governado. `GET /api/knowledge`, `GET /api/knowledge/groups`, `GET /api/knowledge/:group`, `GET /api/knowledge/:group/files`, `GET /api/knowledge/search` e `POST /api/agent/answer` usam `governedRetrieverService`, que primeiro obtem o snapshot aprovado pelo manifesto e so entao constroi o retriever por fingerprint. Esses endpoints nao chamam o loader legado, nao usam `index.json` como autoridade editorial e nao varrem `data/knowledge` para descobrir conteudo publico.

Quando o corpus governado ou o retriever governado nao puderem ser montados, os fluxos publicos falham fechado com `503 KNOWLEDGE_CORPUS_UNAVAILABLE` e mensagem generica. Detalhes internos como caminhos absolutos, fingerprints, issues do manifesto e metadados editoriais nao sao serializados nas respostas publicas. A indisponibilidade do Ollama continua tendo fallback no agente, mas indisponibilidade do corpus governado nao e convertida em resposta fallback.

## Arquivos principais

```text
apps/api/src/rag/
  documentLoader.ts
  governedRetriever.ts
  governedRetrievalErrors.ts
  textSplitter.ts
  retriever.ts
  types.ts
  validateDocuments.ts

apps/api/src/knowledge/
  filesystem.ts
  manifest.ts
  governedCorpus.ts
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

### 1. Manifesto e corpus governado

- consulta o catalogo editorial como autoridade de inclusao
- aceita apenas livros ativos e documentos aprovados
- resolve `filePath` relativo dentro de `data/knowledge`
- calcula `corpusFingerprint` a partir dos bytes lidos para as fontes autorizadas
- monta um snapshot imutavel sem `absolutePath`

### 2. Loader legado

- localiza os arquivos Markdown nas pastas dos dois livros
- le frontmatter e conteudo
- cruza o arquivo com o `index.json`
- monta documentos com metadados consistentes
- permanece disponivel para validacao e usos internos legados, mas nao governa os endpoints publicos da 7B.2

### 3. Splitter

- divide o texto em chunks curtos
- preserva contexto suficiente para resposta simples
- evita trechos longos demais
- mantem referencia ao arquivo original

### 4. Retriever governado

- normaliza a consulta
- expande algumas palavras-chave comuns
- calcula score por ocorrencia e sobreposicao textual
- aceita filtro opcional por `group` e `book`
- ordena os resultados mais uteis
- reutiliza o indice somente enquanto `manifestFingerprint` e `corpusFingerprint` nao mudam

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

As citacoes publicas referenciam apenas metadados e caminhos relativos dos documentos autorizados pelo manifesto. Caminhos absolutos, `manifestFingerprint`, `corpusFingerprint` e metadados editoriais internos nao fazem parte da resposta publica.

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

- expor proveniencia publica mais rica sem caminhos absolutos
- ampliar testes de recuperacao por livro e grupo
- trocar a busca simples por embeddings e vector database quando fizer sentido
- manter a mesma camada de metadados para facilitar a migracao

Nao ha embeddings, reranking nem vector store persistente nesta etapa. A identidade fisica e a invalidacao do cache nao alteram o backend de busca, que continua sendo textual por palavras-chave.
