# CODEX_CONTEXT

## Projeto

- Nome: `portal-estudos-espiritas-ai`
- Tipo: aplicacao web gratuita, responsiva e mobile-first
- Objetivo: apoiar grupos de estudos espiritas online realizados via Google Meet
- Escopo inicial: experiencia de aluno e professor, com frontend publicavel no GitHub Pages e backend local para demo

## Principios de produto

- A aplicacao apoia o estudo e a organizacao das aulas, mas nao substitui professores.
- Toda resposta da assistencia deve ser simples, educativa, respeitosa e revisavel.
- A UI nao deve expor termos tecnicos como `RAG`, `LLM`, `embedding` ou `LangGraph`.
- O sistema deve usar apenas conteudo demonstrativo, autorizado ou produzido pelo proprio projeto.
- Nao copiar livros reais nem obras completas.
- Priorizar codigo limpo, portabilidade, baixo acoplamento e manutencao simples.

## Perfis principais

### Aluno

- Ve a proxima aula e o link do Meet.
- Consulta materiais e resumos.
- Registra duvidas.
- Faz perguntas ao assistente de estudos.
- Acompanha progresso de leitura e participacao.

### Professor

- Escolhe grupo e tema da aula.
- Insere o link do Google Meet.
- Gera roteiro, perguntas e resumos preliminares.
- Revisa e aprova o conteudo gerado.
- Publica materiais para os alunos.

## Grupos iniciais

### Emmanuel

- Dia: segunda-feira
- Horario: 20h
- Participantes: 88

### A Caminho da Luz

- Dia: quarta-feira
- Horario: 20h
- Participantes: 62

## Fluxos principais

### Fluxo do professor

1. Escolhe grupo e tema.
2. Insere link Meet.
3. Gera roteiro e perguntas.
4. Revisa e aprova.
5. Publica.

### Fluxo do aluno

1. Escolhe livro ou grupo.
2. Acessa Meet.
3. Consulta materiais e resumos.
4. Pergunta ao assistente.
5. Acompanha progresso.

## Stack alvo

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Express
- IA: LangChain.js + LangGraph.js
- Modelo local e gratuito: Ollama
- Base inicial de conhecimento: Markdown em `data/knowledge`
- Deploy inicial do frontend: GitHub Pages
- Execucao inicial do backend: local, para demo

## Direcao de arquitetura

### Visao geral

```text
apps/web
  -> consome API HTTP local e dados de demo
  -> publica a experiencia de aluno e professor

apps/api
  -> expoe endpoints REST para aulas, materiais, duvidas, progresso e assistente
  -> orquestra fluxos de revisao e geracao assistida
  -> integra com Ollama e leitura de Markdown autorizado

data/knowledge
  -> armazena materiais demonstrativos em Markdown
  -> organiza conteudo por grupo, tema e tipo de material

packages/shared
  -> concentra tipos, validacoes, helpers e contratos reutilizaveis
```

### Decisoes importantes

- O frontend deve funcionar de forma independente para publicacao estatica no GitHub Pages.
- O backend fica desacoplado para poder rodar localmente, em demo ou ser trocado depois.
- Conteudo gerado para professor nasce como rascunho e exige revisao humana antes de publicar.
- Respostas do assistente devem poder apontar materiais de apoio ou indicar quando algo precisa de confirmacao do professor.
- Dados de demo devem existir para os grupos `Emmanuel` e `A Caminho da Luz`.

## Estrutura de pastas sugerida

```text
portal-estudos-espiritas-ai/
  apps/
    web/
      public/
      src/
        app/
        components/
        features/
          aluno/
          professor/
          grupos/
          assistente/
        routes/
        services/
        styles/
        assets/
        types/
    api/
      src/
        config/
        modules/
          groups/
          lessons/
          materials/
          questions/
          progress/
          assistant/
        adapters/
          ai/
          content/
        workflows/
        routes/
        middleware/
        utils/
  packages/
    shared/
      src/
        schemas/
        types/
        constants/
  data/
    knowledge/
      emmanuel/
      a-caminho-da-luz/
    demo/
      groups/
      lessons/
      materials/
  docs/
    ui-visual-guide.md
  scripts/
  CODEX_CONTEXT.md
```

## Modelos de dados recomendados

- `StudyGroup`: `id`, `name`, `meetingDay`, `meetingTime`, `participantCount`, `bookTitle`, `status`
- `Lesson`: `id`, `groupId`, `title`, `theme`, `scheduledAt`, `meetUrl`, `summary`, `status`
- `Material`: `id`, `groupId`, `lessonId`, `title`, `type`, `sourcePath`, `excerpt`, `publishedAt`
- `StudentQuestion`: `id`, `groupId`, `lessonId`, `authorName`, `question`, `status`, `createdAt`
- `StudyProgress`: `id`, `studentId`, `groupId`, `completedLessons`, `attendanceRate`, `notes`
- `AssistantDraft`: `id`, `kind`, `groupId`, `lessonId`, `promptContext`, `content`, `reviewStatus`

## Contratos de UX que afetam codigo

- A home precisa destacar os dois grupos no topo em formato de card.
- Deve existir uma area `Como usar` com 5 passos.
- No mobile, os passos viram cards empilhados.
- O dashboard precisa ser realmente mobile-first, com largura minima de `360px`.
- Desktop usa sidebar azul persistente.
- Mobile usa menu compacto e navegacao simplificada.
- A experiencia deve ser acolhedora, clara e educacional.
- O rotulo do recurso de IA na UI deve ser algo como `Assistente de estudo`, nunca termos tecnicos.

## Taxonomia de linguagem na UI

### Usar

- `Assistente de estudo`
- `Materiais da aula`
- `Resumo da aula`
- `Perguntas sugeridas`
- `Roteiro da aula`
- `Revisar antes de publicar`

### Evitar

- `RAG`
- `LLM`
- `embedding`
- `agente`
- `grafo`
- `pipeline semantico`

## Conteudo e governanca

- Salvar materiais demonstrativos em Markdown com frontmatter simples.
- Registrar origem e permissao de uso de cada material demo.
- Evitar textos longos copiados integralmente; usar sinteses autorais e trechos autorizados.
- Deixar claro quando um resumo, roteiro ou sugestao foi gerado com apoio do assistente.
- Garantir que o professor possa editar antes da publicacao.

## Comandos esperados

Os scripts abaixo representam a interface de linha de comando desejada para o projeto:

```bash
npm install
npm run dev
npm run dev:web
npm run dev:api
npm run build
npm run build:web
npm run build:api
npm run preview
npm run lint
npm run test
npm run typecheck
npm run demo:seed
```

### Intencao de cada comando

- `npm run dev`: sobe frontend e backend juntos para desenvolvimento local
- `npm run dev:web`: roda apenas o frontend Vite
- `npm run dev:api`: roda apenas a API Express
- `npm run build`: gera build validando todas as partes
- `npm run preview`: valida a versao web compilada
- `npm run demo:seed`: prepara dados demonstrativos dos dois grupos

## Requisitos de qualidade

- TypeScript estrito no frontend e backend.
- Componentes pequenos e reutilizaveis.
- Separar regras de negocio da camada de UI.
- Centralizar tokens visuais em um unico arquivo de tema.
- Preferir acessibilidade nativa e semantica antes de solucoes customizadas.
- Criar fixtures de demo para evitar dependencia de dados externos.
- Manter contratos compartilhados em `packages/shared`.

## Responsividade

- Base mobile-first real a partir de `360px`.
- Conteudo principal em coluna unica no mobile.
- Grid progressivo em tablet e desktop.
- Cards com altura flexivel e leitura confortavel.
- Sidebar fixa apenas em telas largas.
- Tabelas devem virar listas ou cards em telas pequenas.

## Acessibilidade

- Contraste minimo AA.
- Navegacao completa por teclado.
- Foco visivel em todos os controles interativos.
- Alvos de toque de no minimo `44x44px`.
- Labels e estados claros em formularios.
- Estrutura semantica com `header`, `nav`, `main`, `section`, `aside` e `footer` quando fizer sentido.
- Mensagens do assistente e atualizacoes dinamicas com tratamento de leitura para tecnologias assistivas.

## Direcao para implementacao da IA

- O backend pode usar LangChain.js e LangGraph.js internamente.
- O frontend nao deve depender do vocabulrio tecnico da implementacao.
- O Ollama deve ser tratado como provedor local configuravel.
- A base inicial em Markdown deve ser pequena, demonstrativa e facil de versionar.
- Sempre priorizar respostas educativas, breves e passiveis de revisao humana.

## Criterios de sucesso iniciais

- Aluno entende em segundos quando e a proxima aula e como entrar no Meet.
- Professor consegue preparar uma aula com apoio assistido e revisar antes de publicar.
- Os dois grupos aparecem com identidade clara e dados reais de demo.
- O projeto consegue ser iniciado localmente com poucos comandos.
- A experiencia mobile e tao importante quanto a desktop desde o primeiro commit.
