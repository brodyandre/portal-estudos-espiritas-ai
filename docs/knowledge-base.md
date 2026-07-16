# Knowledge Base

## Objetivo

Documentar a base de conhecimento usada pelo portal para apoiar respostas simples, educativas e revisaveis para alunos e professores.

Nesta fase, a base usa apenas arquivos Markdown autorais e resumidos. PDFs das obras nao fazem parte do repositorio nem devem ser expostos pela aplicacao.

## Livros incluidos

- `Emmanuel`
- `A Caminho da Luz`

## Estrutura da base

```text
data/knowledge/
  README.md
  index.json
  orientacoes_do_grupo.md
  emmanuel/
    README.md
    *.md
  a_caminho_da_luz/
    README.md
    *.md
```

Pastas principais:

- `data/knowledge/emmanuel`
- `data/knowledge/a_caminho_da_luz`
- `data/knowledge/index.json`

## Tipos de arquivo

- `visao_geral`: panorama inicial da obra
- `tema`: recorte curto de um assunto central
- `capitulo`: resumo autoral curto de um bloco de leitura
- `faq`: perguntas frequentes com respostas prudentes
- `palavras_chave`: termos e frases de busca

## Como o assistente usa os materiais

1. A API local carrega os arquivos Markdown e o `index.json`.
2. O RAG simples divide os textos em chunks curtos e reaproveita os metadados.
3. O retriever busca por palavras-chave e filtra por grupo ou livro quando necessario.
4. O agente monta uma resposta curta e revisavel.
5. Se o contexto for insuficiente, a resposta orienta conversar com o professor.

No frontend publicado no GitHub Pages, a experiencia continua funcional com fallback local resumido em `apps/web/src/mocks/knowledge.ts`. Esse fallback nao expoe o Markdown completo.

## Uso administrativo da base

A persistencia editorial no PostgreSQL organiza o catalogo sem mudar a fonte do conteudo.

Responsabilidades:

- `data/knowledge` continua sendo a fonte dos arquivos Markdown;
- o RAG continua carregando Markdown e `index.json` diretamente do filesystem;
- o PostgreSQL armazena catalogo, metadados administrativos e estados editoriais;
- `filePath` relativo identifica o documento persistente;
- a API administrativa nao cria, edita, move, renomeia, exclui nem retorna conteudo Markdown integral.
- a interface `/admin/conteudos` consome a API persistente para administrar livros, documentos, metadados e estados editoriais.

Catalogacao manual:

```bash
npm --workspace @portal-estudos-espiritas-ai/api run knowledge:catalog
```

O script le `data/knowledge/index.json`, valida entradas, normaliza caminhos, verifica existencia dos Markdown, cria livros quando necessario, usa a colecao reservada `shared` para conteudos compartilhados e faz upsert por `filePath`.

Reexecucao:

- nao cria duplicidades;
- nao sobrescreve status editorial, notas, revisores, aprovadores ou versionamento;
- nao exclui documentos quando um arquivo deixa de existir;
- registra divergencias com `fileExists: false` nos endpoints de detalhe;
- falhas individuais do indice sao reportadas sem expor caminho absoluto.

A interface administrativa nao executa migration, seed ou catalogacao. Quando o catalogo estiver vazio, ela mostra um estado vazio normal; quando a API ou o banco estiverem indisponiveis, mostra erro operacional separado.

## Metadados do indice

Cada item em `data/knowledge/index.json` deve conter:

- `id`
- `title`
- `group`
- `book`
- `filename`
- `path`
- `type`
- `tags`
- `description`
- `sensitiveTopics`
- `teacherReviewRecommended`

Esses campos ajudam a busca, a exibicao nos paineis e os alertas de revisao humana.

## Frontmatter esperado

Cada arquivo Markdown deve usar frontmatter simples:

```md
---
title: "Titulo claro"
group: "Emmanuel"
purpose: "apoio para respostas simples"
source: "resumo autoral demonstrativo produzido para o portal"
---
```

## Regras editoriais

- usar apenas Markdown autoral, curto e escaneavel
- nao copiar capitulos completos nem trechos longos
- manter linguagem simples, educativa e respeitosa
- nao apresentar o texto como autoridade final
- revisar temas sensiveis com o professor
- nao versionar nem publicar PDFs das obras

## Direitos autorais

O projeto nao foi desenhado para redistribuir livros. A base existe para apoiar estudo, revisao e navegacao entre temas.

Cuidados obrigatorios:

- PDFs originais devem ficar fora do Git
- o repositorio deve guardar apenas resumos autorais
- se houver duvida sobre limite de uso, prefira resumir menos
- nao transcrever capitulos nem trechos extensos

## Temas sensiveis

Os materiais podem marcar assuntos que pedem mais prudencia:

- sofrimento
- mediunidade
- reencarnacao
- instituicoes religiosas
- Capela
- racas adamicas
- guerras
- futuro
- conflitos pessoais

Quando o arquivo tocar algum desses temas, `teacherReviewRecommended` deve ser `true`.

## Como adicionar um novo arquivo Markdown

1. Escolha a pasta correta:
   - `data/knowledge/emmanuel/`
   - `data/knowledge/a_caminho_da_luz/`
2. Crie um arquivo curto com frontmatter valido.
3. Organize o texto com:
   - tema central
   - pontos principais
   - palavras-chave
   - duvidas comuns
   - aplicacao pratica no grupo
   - revisao humana, quando necessario
4. Atualize `data/knowledge/index.json`.
5. Rode `npm run rag:validate`.
6. Se o tema for sensivel, marque revisao humana recomendada.

## Exemplo de uso no projeto

Perguntas como estas tendem a usar bem a base:

- `Como continuar estudando mesmo desanimado?`
- `O que significa esforco proprio?`
- `O livro A Caminho da Luz e historico ou espiritual?`
- `Como entender Capela com prudencia?`
- `Como viver o Evangelho na pratica?`

## Observacao pratica

O backend usa os Markdown e o `index.json` como fonte principal. O frontend publicado no GitHub Pages usa uma camada resumida de fallback para continuar util sem depender da API local.
