# Area Separation Review

## Objetivo

Registrar a validacao final da separacao entre as areas `Publico`, `Aluno`, `Professor` e `Admin`, considerando o modo demonstrativo no GitHub Pages e o modo local com backend.

## Rotas publicas

Rotas implementadas:

- `/`
- `/portal`
- `/educacao-continuada`
- `/inscricao`
- `/divulgacao`
- `/materiais`
- `/materiais/:groupSlug`

Comportamento validado:

- funcionam sem login
- nao exibem link real do Meet
- usam fallback local quando a API nao responde
- mantem linguagem demonstrativa quando necessario

## Rotas de aluno

Rota implementada no MVP:

- `/aluno`

Rotas planejadas para futura separacao interna:

- `/aluno/materiais`
- `/aluno/assistente`
- `/aluno/progresso`

Comportamento validado:

- no GitHub Pages, a area existe apenas em modo demonstrativo
- visitante nao aprovado nao ve o link da aula
- no modo local, aluno aprovado pode abrir o painel
- o link do Meet aparece apenas para perfil autorizado em modo local

## Rotas de professor

Rota implementada no MVP:

- `/professor`

Rotas planejadas para futura separacao interna:

- `/professor/interessados`
- `/professor/aulas`
- `/professor/revisao`

Comportamento validado:

- no GitHub Pages, a area continua demonstrativa
- nao expõe dados reais
- com backend local, o professor pode revisar interessados
- no fluxo atual, o professor pode aprovar, recusar ou marcar para conversar

## Rotas de admin

Rotas implementadas:

- `/admin`
- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/grupos`
- `/admin/conteudos`
- `/admin/configuracoes`
- `/admin/auditoria`

Comportamento validado:

- no GitHub Pages, a area admin funciona como painel demonstrativo
- nao expõe dados reais, segredos ou link real do Meet
- no modo local, o painel pode abrir dashboard, usuarios, grupos, conteudos, configuracoes e auditoria
- a autenticacao real ainda nao existe; o controle atual e demonstrativo

## O que vai para GitHub Pages

- frontend estatico
- paginas publicas
- area de aluno em modo demonstrativo
- area de professor em modo demonstrativo
- area admin em modo demonstrativo
- base de conhecimento autoral e resumida
- mocks nao sensiveis

## O que fica local

- backend em Express
- uso real de `VITE_API_URL`
- revisao operacional de interessados
- controle real do acesso do aluno aprovado
- exibicao do link da aula para perfil autorizado
- configuracoes sensiveis
- auditoria real
- integracao completa com Ollama e leitura real dos Markdown

## Seguranca editorial e privacidade

Validacoes finais:

- nenhum PDF foi encontrado no repositorio
- nenhum token ou segredo foi identificado na revisao final
- mocks usam dados demonstrativos e nao sensiveis
- o link real do Meet nao aparece nas paginas publicas nem no build do GitHub Pages
- WhatsApps e e-mails reais nao aparecem no frontend publicado
- os materiais dos livros seguem a diretriz de conteudo autoral, curto e revisavel

## Limitacoes do MVP

- sem autenticacao real
- sem autorizacao forte por recurso
- sem persistencia segura de producao
- sem auditoria persistente no backend
- sem separacao completa de subrotas internas para aluno e professor
- sem entrega de dados operacionais reais no GitHub Pages

## Proximos passos para producao real

- implementar autenticacao real por perfil
- mover aprovacoes, grupos, configuracoes e auditoria para backend autenticado
- separar subrotas de aluno e professor em recursos dedicados
- entregar o link real do Meet apenas via backend autorizado
- manter GitHub Pages apenas como camada publica ou demonstrativa, se desejado

## Resultado da revisao

O projeto esta consistente com a proposta atual:

- seguro para demonstracao no GitHub Pages
- funcional em modo local com backend
- alinhado com a separacao conceitual entre `Publico`, `Aluno`, `Professor` e `Admin`
- ainda dependente de backend autenticado para qualquer uso de producao real
