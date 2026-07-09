# Guia do Professor

## Objetivo

Explicar como usar o painel do professor para preparar a aula, revisar rascunhos e organizar a semana do grupo.

## Onde acessar

- `/#/professor`: painel do professor

## O que o professor encontra

O painel foi desenhado para apoiar cinco etapas:

1. escolher o grupo e o tema
2. inserir o link do Google Meet
3. pedir sugestoes de roteiro e perguntas
4. revisar e aprovar
5. publicar

## Fluxo recomendado

### 1. Selecionar o grupo

No topo do painel, escolha entre os grupos demonstrativos:

- `Emmanuel`
- `A Caminho da Luz`

Ao trocar o grupo, o restante do painel acompanha o contexto selecionado.

### 2. Preparar a proxima aula

No card `Preparar proxima aula`, informe:

- livro ou estudo base
- tema ou capitulo
- link do Google Meet

Esses campos orientam a geracao dos rascunhos.

### 3. Usar as acoes do painel

O painel oferece quatro acoes:

- `Gerar roteiro`
- `Criar perguntas`
- `Gerar resumo`
- `Publicar`

Nas tres primeiras, a aplicacao tenta buscar um rascunho inicial pela API. Quando o modelo local nao estiver disponivel, a resposta vem em modo demonstrativo.

## Como funciona a previa editavel

Todo conteudo gerado volta para a area `Previa do conteudo` com campos editaveis:

- roteiro da aula
- perguntas sugeridas
- resumo da aula

O objetivo e simples: o sistema ajuda a ganhar tempo, mas a revisao e sempre humana.

## Aprovacao do professor

No card `Aprovacao do professor`, use:

- `Editar`
- `Aprovar`
- `Salvar rascunho`

Comportamento atual da demo:

- a aprovacao e local
- o rascunho e salvo no navegador com `localStorage`
- `Publicar` marca o estado como publicado apenas localmente

Importante:

- a demo nao distribui o conteudo para usuarios reais
- a publicacao atual nao sincroniza automaticamente com o painel do aluno

## Duvidas recebidas

O card `Duvidas recebidas` mostra perguntas demonstrativas do grupo ativo.

Uso sugerido:

- identificar temas recorrentes
- ajustar a abertura da aula
- decidir quais pontos merecem reforco no encontro

## Uso com e sem modelo local

### Com modelo local

- a API tenta usar Ollama para gerar roteiro, perguntas e resumo
- o resultado pode aproveitar contexto dos materiais e resumos cadastrados

### Sem modelo local

- a API cai para um modo de contingencia
- a interface continua funcionando
- o professor ainda pode editar e seguir o fluxo completo

## Uso no celular

O painel tambem foi pensado para 360px:

- menu em drawer
- cards empilhados
- campos em coluna unica
- botoes com area confortavel para toque

Mesmo no mobile, a ordem do fluxo continua clara.

## Boas praticas

- escrever um tema curto e objetivo
- confirmar o link do Meet antes de salvar
- revisar o texto gerado antes de aprovar
- ajustar tom, foco e clareza para o publico do grupo
- evitar publicar qualquer texto sem leitura humana

## Limites desta demo

- sem autenticacao
- sem banco de dados
- sem publicacao real para uma turma externa
- sem historico persistente compartilhado entre dispositivos

Esses limites sao intencionais para manter o projeto simples, portavel e util para demonstracao tecnica.

## Recomendacao final

Use o painel como ferramenta de preparacao. O valor principal nao esta em automatizar o professor, e sim em reduzir trabalho repetitivo, organizar melhor a aula e deixar mais tempo para a revisao humana.
