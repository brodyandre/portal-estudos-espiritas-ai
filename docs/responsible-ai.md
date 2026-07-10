# Responsible AI

## Objetivo

Registrar as regras de uso responsavel da assistencia do projeto, deixando claro o papel da tecnologia, os limites editoriais e a importancia da revisao humana.

## Base usada nesta fase

O projeto trabalha com dois livros organizados em resumos autorais curtos:

- `Emmanuel`
- `A Caminho da Luz`

Pastas principais:

- `data/knowledge/emmanuel`
- `data/knowledge/a_caminho_da_luz`

Os arquivos sao usados como apoio de estudo. Eles nao substituem leitura orientada, conversa em grupo nem acompanhamento do professor.

## Papel da assistencia

Na pratica, a assistencia serve para:

- organizar uma resposta inicial para o aluno
- sugerir roteiro, perguntas e resumo para o professor
- recuperar contexto em materiais cadastrados
- manter linguagem simples, educativa e revisavel

## Limites do sistema

O sistema nao deve:

- assumir autoridade doutrinaria
- substituir revisao humana
- inventar citacoes
- reproduzir obras completas
- orientar casos pessoais delicados como se fosse palavra final

## Como o assistente usa os materiais

- a API local carrega os arquivos Markdown e o `index.json`
- a recuperacao busca trechos curtos e metadados relacionados
- o agente responde de forma breve e prudente
- no GitHub Pages, o frontend usa fallback resumido quando a API nao esta disponivel

## Direitos autorais

Cuidados obrigatorios:

- nao versionar PDFs das obras
- nao expor PDFs na aplicacao
- nao copiar capitulos completos
- nao copiar trechos longos
- manter apenas resumos autorais, curtos e revisaveis

Nota editorial do projeto:

> Por responsabilidade editorial e direitos autorais, o projeto nao versiona os PDFs das obras. A base de conhecimento utiliza arquivos Markdown autorais, curtos e revisaveis.

## Revisao humana obrigatoria

### Para o aluno

- a resposta do assistente e apoio inicial
- perguntas importantes devem ser confirmadas com o professor
- a interface nao deve ser tratada como fonte definitiva

### Para o professor

- roteiro, perguntas e resumo nascem como rascunho
- o professor revisa, ajusta e aprova antes de publicar
- temas sensiveis exigem leitura ainda mais cuidadosa

## Temas sensiveis

Alguns temas pedem prudencia reforcada:

- sofrimento intenso
- luto
- mediunidade pessoal
- reencarnacao
- instituicoes religiosas
- Capela
- racas adamicas
- guerras
- futuro da humanidade
- conflitos pessoais

Quando esses temas aparecem:

- a resposta deve ser curta e revisavel
- o sistema deve recomendar conversa com o professor
- o professor deve revisar antes de compartilhar

## Diferenca entre GitHub Pages e backend local

### GitHub Pages

- publica apenas o frontend
- usa fallback local quando a API nao responde
- e adequado para portfolio e navegacao demonstrativa

### Backend local

- le a base real em Markdown
- executa a busca local
- integra o agente e o Ollama quando disponivel

## Como o projeto lida com falhas

### Se o modelo local falhar

- a API usa fallback claro
- a resposta continua disponivel em modo de contingencia

### Se o contexto for insuficiente

- a resposta evita parecer excessivamente segura
- o usuario recebe orientacao para levar a duvida ao professor

### Se a API falhar

- o frontend continua com fallback local
- isso preserva a demonstracao, mas nao substitui validacao humana

## Como adicionar novos materiais com seguranca

1. Crie um novo Markdown curto na pasta correta.
2. Use frontmatter com `title`, `group`, `purpose` e `source`.
3. Atualize `data/knowledge/index.json`.
4. Marque `teacherReviewRecommended` quando houver tema sensivel.
5. Rode `npm run rag:validate`.

## Resumo

Este projeto usa assistencia como apoio de estudo e organizacao. A prioridade nao e parecer definitivo, e sim ser util, claro, prudente e honesto sobre o que consegue ou nao consegue fazer.
