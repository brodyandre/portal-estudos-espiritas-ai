# Responsible AI

## Objetivo

Registrar as regras de uso responsavel da assistencia do projeto, deixando claro o papel da tecnologia e os limites que nao devem ser ultrapassados.

## Papel da assistencia neste projeto

O sistema foi criado para apoiar grupos de estudo, nao para substituir professores.

Na pratica, a assistencia serve para:

- organizar uma resposta inicial para o aluno
- sugerir roteiro, perguntas e resumo para o professor
- recuperar contexto em materiais demonstrativos cadastrados
- manter linguagem simples, educativa e revisavel

## Limites do sistema

O sistema nao deve:

- assumir autoridade doutrinaria
- substituir revisao humana
- inventar citacoes
- reproduzir obras completas
- responder como se fosse a palavra final do grupo ou do professor

## Regras de conteudo

- usar apenas conteudo demonstrativo, autoral ou autorizado
- nao copiar livros reais nem materiais protegidos em bloco
- preferir sinteses curtas e trechos claramente permitidos
- manter a origem do material o mais rastreavel possivel

## Regras de resposta

Toda resposta do sistema deve buscar:

- simplicidade
- tom respeitoso
- valor educativo
- clareza sobre limites
- possibilidade de revisao

Quando faltar contexto, a resposta deve orientar o usuario a levar a duvida ao professor.

## Revisao humana obrigatoria

### Para o aluno

- a resposta do assistente e apoio inicial
- perguntas importantes devem ser confirmadas com o professor
- o aluno deve tratar a interface como ferramenta de estudo, nao como fonte definitiva

### Para o professor

- roteiro, perguntas e resumo nascem como rascunho
- o professor revisa, ajusta e aprova antes de publicar
- nenhuma geracao automatica deve ser compartilhada sem leitura humana

## Como o projeto lida com falhas

### Se o modelo local falhar

- a API usa fallback claro
- a resposta continua disponivel em modo de contingencia
- a interface nao esconde que houve fallback

### Se o contexto for insuficiente

- o endpoint de resposta evita parecer excessivamente seguro
- a resposta sugere conversar com o professor

### Se a API falhar

- o frontend pode continuar com mocks locais
- isso preserva a demonstracao, mas nao substitui validacao humana

## Transparencia para o usuario

O projeto evita jargao tecnico na interface, mas isso nao significa esconder o funcionamento.

Compromissos de transparencia:

- indicar que a resposta foi baseada nos materiais cadastrados
- deixar claro quando houver necessidade de revisao humana
- tratar fallback como contingencia, nao como se fosse resultado identico ao modelo local

## Seguranca de produto nesta etapa

O projeto ainda e uma demo e, por isso, tem limites intencionais:

- sem autenticacao
- sem moderacao avancada
- sem trilha completa de auditoria
- sem politica formal de permissao por perfil

Mesmo assim, algumas decisoes ja ajudam:

- validacao simples de entrada na API
- centralizacao de tratamento de erros
- prompts e fallbacks em tom contido
- lembrete constante de revisao humana

## Boas praticas para evolucao

- ampliar testes dos fluxos de assistencia
- registrar melhor origem dos materiais demonstrativos
- adicionar rastreio de fallback e de contexto usado
- incluir moderacao adicional para entradas mais longas
- criar processo de revisao editorial dos materiais em Markdown

## Resumo

Este projeto usa assistencia como apoio de estudo e organizacao. A prioridade nao e parecer inteligente, e sim ser util, claro, seguro dentro do escopo e honesto sobre o que consegue ou nao consegue fazer.
