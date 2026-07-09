# UI Visual Guide

## Objetivo visual

Construir um dashboard moderno, limpo, acolhedor e educacional para grupos de estudos espiritas. A interface deve passar calma, organizacao e confianca, com linguagem simples e foco em leitura.

## Direcao estetica

- Sensacao principal: serenidade, clareza e proximidade humana.
- Aparencia: cards claros sobre fundo suave, com contraste suficiente e poucos elementos ruidosos.
- Estilo: educacional contemporaneo, sem excesso decorativo e sem visual corporativo frio.
- Tom do produto: respeitoso, didatico e acolhedor.

## Paleta principal

```css
:root {
  --color-brand-900: #163a5f;
  --color-brand-800: #1d4d78;
  --color-brand-700: #2b628f;
  --color-surface-0: #fcfaf6;
  --color-surface-50: #f6f1e8;
  --color-surface-100: #ebe2d2;
  --color-card: #ffffff;
  --color-text-900: #1f2933;
  --color-text-700: #52606d;
  --color-text-500: #7b8794;
  --color-border: #d8dee6;
  --color-positive-700: #2f7a59;
  --color-positive-100: #e7f4ec;
  --color-warning-700: #9a6700;
  --color-warning-100: #fff3d6;
  --color-focus: #0f6fbd;
}
```

## Uso das cores

- Azul profundo: navegacao principal, sidebar, botoes primarios, links importantes.
- Branco e off-white: fundos, paineis e areas de leitura.
- Bege claro: apoio visual em blocos explicativos e area `Como usar`.
- Cinza suave: textos secundarios, bordas e icones neutros.
- Verde positivo: progresso, publicacao concluida, confirmacoes e avancos.

## Tipografia

- Titulos: `Fraunces`, `Georgia`, `serif`
- Texto corrido: `Atkinson Hyperlegible`, `Segoe UI`, `sans-serif`
- Numeros e pequenos dados tabulares: mesma familia do corpo para manter consistencia

### Escala sugerida

- `text-display`: 32/38, peso 600
- `text-h1`: 28/34, peso 600
- `text-h2`: 22/28, peso 600
- `text-h3`: 18/24, peso 600
- `text-body-lg`: 17/27, peso 400
- `text-body`: 16/24, peso 400
- `text-body-sm`: 14/21, peso 400
- `text-label`: 13/18, peso 600

## Espacamento e forma

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-xl: 28px;

  --shadow-card: 0 10px 30px rgba(22, 58, 95, 0.08);
  --shadow-popover: 0 16px 40px rgba(22, 58, 95, 0.14);
}
```

### Regras

- Cards principais usam `--radius-lg` e `--shadow-card`.
- Inputs e botoes usam `--radius-md`.
- Evitar sombras pesadas ou blur exagerado.
- Espacamento interno padrao de cards: `20px` no mobile e `24px` no desktop.

## Layout principal

### Desktop

- Sidebar azul fixa a esquerda.
- Conteudo principal em area clara com largura confortavel.
- Cabecalho do dashboard com saudacao, seletor de grupo e acao principal.
- Dois cards de grupos no topo, lado a lado quando houver espaco.

### Mobile

- Header compacto com titulo, seletor e botao de menu.
- Navegacao recolhida em drawer ou sheet.
- Conteudo em coluna unica.
- Cards com largura total e espacamento vertical claro.

## Breakpoints

```text
Base: 360px
sm: 480px
md: 768px
lg: 1024px
xl: 1280px
```

### Comportamento esperado

- `360px-479px`: tudo em coluna unica, foco em leitura e toque.
- `480px-767px`: cards ainda empilhados, mas com mais respiro horizontal.
- `768px-1023px`: grids de 2 colunas quando fizer sentido; menu ainda pode ser compacto.
- `1024px+`: sidebar fixa, grids mais amplos e areas de contexto simultaneas.

## Componentes-chave

### Cards de grupo

- Devem aparecer no topo da home.
- Exibir nome do grupo, dia, horario, participantes e proxima acao.
- Cada card deve ter CTA claro: `Entrar na aula` ou `Ver planejamento`.
- Diferenciar visualmente o grupo ativo com borda azul ou faixa superior.

### Card de proxima aula

- Destaque para data, horario, tema e link do Meet.
- O botao principal deve ser imediatamente visivel.
- Mostrar estado claro para `aula hoje`, `proxima aula` ou `aguardando publicacao`.

### Area "Como usar"

- Sempre com 5 passos.
- Desktop: pode usar grid horizontal ou duas linhas equilibradas.
- Mobile: obrigatoriamente vira cards empilhados, um passo por card.
- Cada passo deve ter numero forte, titulo curto e descricao de uma frase.

### Cards de resumo e materiais

- Priorizar leitura escaneavel.
- Mostrar tipo do material, ultimo update e acao principal.
- Usar icones simples e discretos.

### Bloco do assistente

- Nome visivel: `Assistente de estudo`.
- Deve incluir aviso curto de apoio humano, por exemplo: `Revise e confirme com o professor quando necessario.`
- Historico em baloes simples, sem visual de chat excessivamente informal.

### Painel do professor

- Fluxo deve ser mostrado de forma progressiva:
  1. Grupo e tema
  2. Link do Meet
  3. Gerar roteiro e perguntas
  4. Revisar
  5. Publicar
- Cada etapa pode aparecer como stepper simples no topo ou lateral.
- Itens gerados pela assistencia devem nascer com selo `Rascunho`.

## Hierarquia visual por tela

### Dashboard do aluno

- Primeiro: grupos e proxima aula
- Segundo: materiais e resumo
- Terceiro: assistente e progresso
- Quarto: duvidas recentes ou perguntas sugeridas

### Dashboard do professor

- Primeiro: grupo ativo, tema e status da aula
- Segundo: formulario do Meet e geracao de roteiro
- Terceiro: revisao de perguntas, resumo e publicacao
- Quarto: duvidas enviadas pelos alunos

## Tokens de componentes

```css
:root {
  --layout-max-width: 1200px;
  --sidebar-width: 280px;
  --header-height: 72px;
  --mobile-header-height: 64px;
  --card-padding-mobile: 20px;
  --card-padding-desktop: 24px;
  --button-height: 44px;
  --input-height: 48px;
}
```

## Botoes e estados

- Primario: fundo azul profundo, texto branco, hover levemente mais claro.
- Secundario: fundo branco, borda azul suave, texto azul profundo.
- Sucesso: verde suave apenas para confirmacao ou progresso, nunca como cor dominante da interface.
- Desabilitado: contraste suficiente e texto claro sobre fundo neutro.

### Estados de feedback

- `Rascunho`: bege claro + texto escuro
- `Publicado`: verde claro + texto verde escuro
- `Requer revisao`: amarelo suave + texto de alerta
- `Sem dados`: cinza claro + texto secundario

## Iconografia e ilustracao

- Preferir icones de traco simples e arredondado.
- Evitar ilustracoes excessivamente infantis ou misticas.
- Se houver ilustracao de apoio, manter linguagem serena e discreta.

## Conteudo e microcopy

### Deve soar

- Claro
- Educativo
- Respeitoso
- Tranquilo
- Objetivo

### Deve evitar

- Jargao tecnico
- Promessas absolutas
- Tom robotico
- Excesso de texto por card

### Exemplos de rotulos bons

- `Entrar no encontro`
- `Ver materiais`
- `Resumo da ultima aula`
- `Perguntar ao assistente`
- `Revisar antes de publicar`

## Responsividade detalhada

- Nunca depender de hover como unica forma de descobrir uma acao.
- Cards devem quebrar para coluna unica antes de ficarem apertados.
- Formularios longos do professor devem usar pilha vertical no mobile.
- Tabelas ou listas densas devem virar cards resumidos abaixo de `768px`.
- Sidebar nao deve roubar largura util em telas pequenas; usar drawer.
- O CTA principal de cada tela precisa aparecer acima da dobra em `360px`.

## Acessibilidade

- Contraste AA para texto, bordas e estados.
- Ordem de foco coerente com a leitura visual.
- Links e botoes com area minima de `44x44px`.
- Titulos descritivos e hierarquia sem saltos arbitrarios.
- Inputs com label sempre visivel.
- Mensagens de erro proximas ao campo e em linguagem simples.
- Stepper do professor deve funcionar por teclado e leitores de tela.
- Respostas do assistente devem anunciar atualizacoes importantes sem interromper excessivamente.

## Implementacao visual sugerida

- Centralizar tokens em `apps/web/src/styles/tokens.css` ou equivalente.
- Definir tema base com CSS variables desde o inicio.
- Criar primitives simples para `Card`, `Button`, `Badge`, `SectionHeader`, `Stat` e `EmptyState`.
- Evitar estilos espalhados por feature sem reuso de tokens.

## Checklist de aceite visual

- Os dois grupos aparecem no topo da home em cards claros e legiveis.
- Existe uma area `Como usar` com 5 passos e empilhamento no mobile.
- Desktop usa sidebar azul; mobile usa menu compacto.
- A interface fica confortavel em `360px`.
- O assistente aparece como apoio de estudo, nao como substituto do professor.
- Nao ha termos tecnicos expostos na UI.
- O conjunto visual transmite calma, organizacao e confianca.
