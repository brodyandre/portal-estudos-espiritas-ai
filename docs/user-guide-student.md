# Guia do Aluno

## Objetivo

Explicar como usar o painel do aluno de forma simples, tanto no desktop quanto no celular.

## Onde acessar

- `/#/portal`: pagina aberta, compartilhavel e sem login
- `/#/educacao-continuada`: pagina publica para quem chega pelo QR Code
- `/#/inscricao`: formulario simples de interesse
- `/#/aluno`: painel completo do aluno
- `/#/materiais`: acesso rapido aos materiais dos livros

## Livros e grupos disponiveis

- `Emmanuel`
- `A Caminho da Luz`

Esses livros aparecem no painel como selecao de grupo ou livro para organizar materiais e perguntas.

## O que o aluno encontra

No painel do aluno, a experiencia foi organizada para facilitar o estudo semanal:

- proxima aula
- botao para entrar no Google Meet, quando o acesso ja foi aprovado
- seletor de grupo ou livro
- materiais de apoio do livro escolhido
- assistente de estudo e envio de duvidas
- resumo da ultima aula
- progresso demonstrativo

## Como usar

Antes do acesso ao painel completo:

1. escaneie o QR Code ou abra `/#/educacao-continuada`
2. leia a proposta dos grupos
3. preencha a inscricao com dados minimos
4. aguarde a revisao dos professores
5. depois da aprovacao, abra a area do aluno

Dentro do painel:

1. Escolha o grupo ou livro desejado.
2. Veja a proxima aula e confira o horario.
3. Use o botao do Google Meet quando estiver perto do encontro.
4. Leia os materiais de apoio, o resumo e as tags do tema.
5. Se precisar, envie uma pergunta ao assistente.
6. Se a duvida continuar importante, envie ao professor.
7. Acompanhe o progresso demonstrativo no painel.

## Materiais de apoio

O card `Materiais de apoio` mostra arquivos curtos da base do grupo selecionado.

Voce pode ver:

- titulo do material
- tipo do arquivo, como tema, capitulo, FAQ ou palavras-chave
- tags principais
- resumo curto
- aviso de revisao humana quando necessario

O objetivo nao e entregar o livro inteiro na tela, e sim organizar apoios curtos para estudo.

## Pergunte ao assistente

O bloco `Pergunte ao assistente` serve como apoio inicial.

Ele pode ajudar a:

- retomar um tema da semana
- resumir um ponto simples
- indicar materiais relacionados
- organizar uma duvida para levar ao professor

Exemplos de perguntas:

- `Como continuar estudando mesmo desanimado?`
- `O que significa esforco proprio?`
- `O livro A Caminho da Luz e historico ou espiritual?`
- `Como entender Capela com prudencia?`
- `Como viver o Evangelho na pratica?`

## O que esperar da resposta

- linguagem curta e educativa
- fontes baseadas nos materiais cadastrados
- aviso de que a resposta e apoio inicial
- recomendacao de conversar com o professor em temas sensiveis

No frontend publicado sem backend, a resposta pode aparecer em modo demonstrativo.

## Enviar duvida ao professor

Depois de perguntar ao assistente, o aluno pode usar o botao `Enviar duvida ao professor`.

Na demo atual:

- a pergunta e registrada localmente ou enviada para a API quando disponivel
- o objetivo e simular o fluxo de acompanhamento
- nao existe banco nem notificacao real nesta etapa

## Uso no celular

No mobile, o painel prioriza:

1. proxima aula
2. botao Meet
3. assistente e duvidas
4. materiais
5. progresso e resumo

Boas praticas:

- abra o menu pelo header
- use os cards em coluna unica
- toque nos botoes principais sem ampliar a tela

## Se algo nao carregar

O frontend foi preparado para continuar util mesmo quando a API falha.

Isso significa que:

- grupos e materiais podem aparecer em modo demonstrativo
- perguntas frequentes e palavras-chave continuam disponiveis
- respostas do assistente podem vir de fallback local
- a navegacao segue funcionando no GitHub Pages
- o fluxo de inscricao continua funcionando em modo demonstrativo

Quando isso acontecer, a interface pode avisar:

`Modo demonstrativo: para aprovação real de alunos, rode o backend local.`

## Limites importantes

- o assistente nao substitui o professor
- a resposta nao deve ser tratada como orientacao final
- o projeto nao expoe PDFs nem conteudo longo das obras
- o progresso exibido e apenas ilustrativo
- o acesso do aluno no MVP usa controle simples, nao autenticacao real

## Recomendacao final

Use o painel para se organizar melhor, chegar preparado ao encontro e registrar duvidas com clareza. Quando surgir um ponto sensivel, a referencia principal continua sendo o professor e o estudo feito em grupo.
