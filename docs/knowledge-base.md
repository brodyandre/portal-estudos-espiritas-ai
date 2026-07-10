# Knowledge Base

## Objetivo

Documentar a base de conhecimento em `data/knowledge`, organizada para apoiar respostas simples, educativas e revisaveis no portal.

Nesta etapa, a base usa apenas arquivos Markdown autorais e resumidos. PDFs das obras nao fazem parte do repositorio nem devem ser expostos pela aplicacao.

## Estrutura da base

```text
data/knowledge/
  README.md
  index.json
  orientacoes_do_grupo.md
  emmanuel_demo.md
  a_caminho_da_luz_demo.md
  emmanuel/
    README.md
    ...
  a_caminho_da_luz/
    README.md
    ...
```

### Tipos de arquivo

- `visao_geral`: panorama inicial da obra ou do grupo.
- `tema`: recorte curto de um assunto central.
- `capitulo`: resumo autoral curto de um bloco ou capitulo.
- `faq`: perguntas frequentes com respostas prudentes.
- `palavras_chave`: termos, sinonimos e frases de busca.
- `demo`: material demonstrativo inicial.
- `orientacoes`: combinados de convivio e uso do portal.
- `readme`: documentacao local da base.

## Livros incluidos

- `Emmanuel`
- `A Caminho da Luz`

Tambem existem arquivos compartilhados de apoio, como o README geral da base e orientacoes do grupo.

## Regras de uso

- usar apenas Markdown autoral, curto e escaneavel;
- nao copiar capitulos completos nem trechos longos;
- manter linguagem simples, educativa e respeitosa;
- nao apresentar respostas como autoridade final;
- tratar o professor como referencia de revisao humana nos pontos mais sensiveis;
- nao expor nem versionar PDFs das obras.

## Direitos autorais e responsabilidade editorial

- os PDFs originais servem apenas como fonte privada de leitura;
- o repositorio deve guardar somente resumos autorais demonstrativos;
- toda expansao da base deve evitar transcricao extensa;
- quando houver duvida sobre limite de uso, prefira resumir menos e revisar mais.

Nota curta do projeto:

> Por responsabilidade editorial e direitos autorais, o projeto nao versiona os PDFs das obras. A base de conhecimento utiliza arquivos Markdown autorais, curtos e revisaveis.

## Revisao humana

O arquivo `data/knowledge/index.json` registra dois campos para consumo futuro:

- `sensitiveTopics`: lista os assuntos que pedem mais cuidado;
- `teacherReviewRecommended`: marca quando o professor deve revisar com mais atencao.

Temas que normalmente exigem revisao:

- sofrimento
- mediunidade
- reencarnacao
- instituicoes religiosas
- Capela
- racas adamicas
- crises
- guerras
- futuro
- conflitos pessoais

## Como adicionar novos arquivos

1. Escolha o grupo e a pasta correta:
   - `data/knowledge/emmanuel/`
   - `data/knowledge/a_caminho_da_luz/`
2. Crie um arquivo Markdown curto com frontmatter:

```md
---
title: "Titulo claro"
group: "Emmanuel"
purpose: "apoio para respostas simples"
source: "resumo autoral demonstrativo produzido para o portal"
---
```

3. Estruture o conteudo com:
   - tema central
   - pontos principais
   - palavras-chave
   - duvidas comuns
   - aplicacao pratica no grupo
   - revisao humana, quando necessario
4. Atualize `data/knowledge/index.json` com:
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
5. Se o tema for sensivel, marque `teacherReviewRecommended` como `true`.

## Observacao de compatibilidade

Nesta fase, a base ainda possui arquivos legados e arquivos padronizados convivendo lado a lado. Isso foi mantido para permitir evolucao gradual sem alterar frontend, backend ou regras do agente nesta etapa.
