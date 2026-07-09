# RAG Simples

## Objetivo

Implementar uma base inicial de recuperacao de contexto usando apenas arquivos Markdown locais em `data/knowledge`, sem banco vetorial nesta etapa.

## Escopo atual

- Carrega `data/knowledge/*.md`.
- Le frontmatter simples com metadados do documento.
- Divide o texto em chunks pequenos para busca.
- Faz busca por palavras-chave com score.
- Retorna resultados com `source`, `title`, `content` e `score`.
- Mantem a estrutura pronta para trocar a busca simples por vetor no futuro.

## Arquivos principais

```text
apps/api/src/rag/
  documentLoader.ts
  textSplitter.ts
  retriever.ts
  types.ts
  validateDocuments.ts
```

## Formato esperado dos documentos

Cada Markdown deve ficar em `data/knowledge` e usar frontmatter simples:

```md
---
title: "Leitura demonstrativa"
group: "Emmanuel"
purpose: "apoio para encontro online"
source: "conteudo autoral demonstrativo"
---

# Titulo visivel

Texto curto, simples e autorizado.
```

## Regras de conteudo

- Usar apenas material demonstrativo, autoral ou autorizado.
- Nao copiar obras completas.
- Evitar trechos longos protegidos.
- Manter textos curtos e apropriados para revisao humana.

## Como funciona

### Loader

- Localiza a pasta `data/knowledge`.
- Lê apenas arquivos `.md`.
- Extrai frontmatter e conteudo.
- Monta objetos `KnowledgeDocument` com metadados e contagem basica.

### Splitter

- Divide o texto por paragrafos.
- Mantem chunks pequenos por tamanho de caracteres.
- Aplica pequena sobreposicao para preservar contexto.
- Guarda metadados prontos para futura referencia vetorial, como `vectorRef`.

### Retriever

- Normaliza consulta e chunks.
- Faz busca simples por palavras-chave.
- Atribui score com peso maior para titulo e para cobertura de termos.
- Ordena pelos melhores resultados e limita a quantidade retornada.

## Resultado da busca

Cada item retornado tem este formato:

```ts
{
  source: string;
  title: string;
  content: string;
  score: number;
}
```

Tambem sao mantidos metadados adicionais como `documentId`, `chunkIndex` e `vectorRef`.

## Validacao dos documentos

Script disponivel:

```bash
npm run rag:validate
```

Ele verifica:

- se a pasta `data/knowledge` existe
- se ha arquivos `.md`
- se o frontmatter tem `title`, `group`, `purpose` e `source`
- se o conteudo tem tamanho minimo
- se o campo `source` indica material demonstrativo, autoral ou autorizado

## Proxima evolucao sugerida

- conectar o retriever ao endpoint `/api/agent/answer`
- adicionar cache em memoria para documentos e chunks
- trocar a busca por palavras-chave por embeddings e vector database
- registrar trechos usados nas respostas do assistente
