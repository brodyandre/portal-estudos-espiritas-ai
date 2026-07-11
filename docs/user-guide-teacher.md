# Guia do Professor

## Objetivo

Explicar como usar o painel do professor para preparar a aula, revisar rascunhos e aproveitar a base dos dois livros com seguranca editorial.

## Onde acessar

- `/#/professor`: painel do professor
- `/#/materiais`: pagina publica de apoio com os materiais organizados por livro
- `/#/divulgacao`: orientacao curta para saber qual URL deve virar QR Code no cartaz

## Livros e grupos disponiveis

- `Emmanuel`
- `A Caminho da Luz`

O professor pode trocar o livro ou grupo no topo do painel para atualizar o contexto da aula.

## O que o professor encontra

O painel foi desenhado para apoiar estas etapas:

1. escolher o grupo e o tema
2. inserir o link do Google Meet
3. selecionar materiais da base como apoio
4. pedir sugestoes de roteiro, perguntas, resumo ou mensagem
5. revisar, aprovar e salvar localmente

Tambem ha apoio para:

- revisar inscricoes de novos alunos
- aprovar, recusar ou marcar para conversar
- orientar a divulgacao correta do QR Code

## Base de apoio da aula

O card `Base de apoio da aula` lista materiais curtos do grupo selecionado.

Ele ajuda o professor a:

- selecionar um ou mais arquivos de apoio
- ver tags principais
- identificar temas sensiveis
- montar melhor o contexto da aula

Os materiais ficam organizados em:

- `data/knowledge/emmanuel`
- `data/knowledge/a_caminho_da_luz`

## Gerar apoio para aula

O painel permite solicitar:

- `Gerar roteiro da aula`
- `Gerar perguntas de reflexao`
- `Gerar resumo para participantes`
- `Gerar mensagem para o grupo`
- `Listar pontos que exigem revisao`

Essas acoes usam a API local quando disponivel. Se a API ou o modelo local falharem, o frontend continua em modo demonstrativo.

## Como funciona a previa editavel

Todo conteudo gerado volta para a area de previa com campos editaveis.

O objetivo e simples:

- ganhar tempo na preparacao
- manter o professor no controle
- facilitar ajuste de tom, foco e clareza

## Como divulgar o QR Code

Para materiais impressos, cartazes e convites, use a rota:

- `/#/educacao-continuada`

Ela foi pensada para:

- apresentar os grupos antes da inscricao
- orientar novos participantes com linguagem acolhedora
- levar o visitante ao formulario sem expor o encontro

Evite colocar o link do Google Meet diretamente no cartaz.

Motivo:

- melhora a organizacao
- preserva o acolhimento
- reduz exposicao indevida do encontro
- facilita o acompanhamento dos novos alunos

Texto sugerido para o cartaz:

`Escaneie o QR Code para conhecer os grupos, fazer sua inscricao e receber o acesso as aulas online.`

Se quiser revisar essa orientacao no proprio projeto, abra:

- `/#/divulgacao`

## Como revisar novas inscricoes

No painel do professor, a secao `Novos interessados` ajuda a:

- ver quem preencheu o cadastro
- filtrar por status
- filtrar por grupo
- adicionar observacao curta
- aprovar, recusar ou marcar para conversar

Regras importantes:

- o cadastro coleta apenas dados minimos
- o link do Meet nao aparece publicamente
- a aprovacao libera a area do aluno e o link da aula
- em modo demonstrativo, a aprovacao local nao substitui um fluxo real de autenticacao

## Pontos sensiveis

O painel destaca com mais cuidado temas como:

- sofrimento
- mediunidade
- reencarnacao
- instituicoes religiosas
- Capela
- racas adamicas
- guerras
- futuro
- conflitos pessoais

Nesses casos, a recomendacao e direta:

`O professor deve revisar antes de publicar.`

## Como testar localmente

1. Suba a API:

```bash
npm run dev:api
```

2. Suba o frontend:

```bash
npm run dev:web
```

3. Experimente perguntas e geracoes com temas como:

- `Como continuar estudando mesmo desanimado?`
- `O que significa esforco proprio?`
- `O livro A Caminho da Luz e historico ou espiritual?`
- `Como entender Capela com prudencia?`
- `Como viver o Evangelho na pratica?`

## Uso com e sem backend

### Com backend local

- a API le os arquivos Markdown dos dois livros
- a busca local recupera os materiais mais aderentes
- o agente monta respostas e rascunhos curtos

### Sem backend

- o frontend continua funcional
- a base aparece por fallback resumido
- as respostas e geracoes passam a ser demonstrativas
- as inscricoes e aprovacoes podem funcionar em modo demonstrativo local

Esse comportamento foi pensado para manter o GitHub Pages util sem expor infraestrutura extra.

## Boas praticas

- escrever um tema curto e objetivo
- selecionar materiais realmente ligados ao encontro
- revisar todo texto antes de aprovar
- tratar a geracao como rascunho, nao como publicacao final
- reforcar prudencia em temas sensiveis

## Limites desta demo

- sem autenticacao
- sem banco de dados
- sem publicacao real para alunos externos
- sem sincronizacao entre dispositivos

## Recomendacao final

Use o painel como ferramenta de preparacao. O valor principal nao esta em automatizar o professor, e sim em reduzir trabalho repetitivo, organizar a aula e preservar a revisao humana.
