export type NavigationItem =
  | {
      type: "route";
      to: string;
      label: string;
      description: string;
    }
  | {
      type: "section";
      targetId: string;
      label: string;
      description: string;
    };

export interface SidebarConfig {
  badge: string;
  title: string;
  description: string;
  footerTitle: string;
  footerDescription: string;
  navLabel: string;
  items: NavigationItem[];
}

export const appSidebarConfig: SidebarConfig = {
  badge: "Projeto demonstrativo",
  title: "Portal de Estudos Espiritas AI",
  description: "Organizacao acolhedora para encontros online via Google Meet.",
  footerTitle: "Apoio com revisao humana",
  footerDescription:
    "A plataforma ajuda a estudar, organizar materiais e preparar encontros, mas nao substitui professores.",
  navLabel: "Navegacao principal",
  items: [
    {
      type: "route",
      to: "/",
      label: "Inicio",
      description: "Visao geral do projeto e grupos em destaque.",
    },
    {
      type: "route",
      to: "/portal",
      label: "Portal",
      description: "Panorama geral dos encontros e acessos principais.",
    },
    {
      type: "route",
      to: "/aluno",
      label: "Aluno",
      description: "Aulas, materiais, resumos, duvidas e progresso.",
    },
    {
      type: "route",
      to: "/professor",
      label: "Professor",
      description: "Planejamento, revisao e publicacao do encontro.",
    },
  ],
};

export const studentSidebarConfig: SidebarConfig = {
  badge: "Painel do Aluno",
  title: "Portal dos Estudos Espiritas Online",
  description: "Acesso simples a encontros, materiais, duvidas e progresso.",
  footerTitle: "Estudo com apoio humano",
  footerDescription:
    "O assistente ajuda na revisao do estudo, mas a orientacao do professor continua essencial.",
  navLabel: "Navegacao do painel do aluno",
  items: [
    {
      type: "section",
      targetId: "aluno-inicio",
      label: "Inicio",
      description: "Voltar ao topo do painel do aluno.",
    },
    {
      type: "section",
      targetId: "grupo-emmanuel",
      label: "Emmanuel",
      description: "Ir ao card do grupo Emmanuel.",
    },
    {
      type: "section",
      targetId: "grupo-a-caminho-da-luz",
      label: "A Caminho da Luz",
      description: "Ir ao card do grupo A Caminho da Luz.",
    },
    {
      type: "section",
      targetId: "materiais-da-semana",
      label: "Materiais",
      description: "Ver os materiais e a leitura recomendada da semana.",
    },
    {
      type: "section",
      targetId: "duvidas-enviadas",
      label: "Duvidas",
      description: "Revisar perguntas enviadas e resposta do assistente.",
    },
    {
      type: "section",
      targetId: "meu-progresso",
      label: "Meu progresso",
      description: "Acompanhar presenca, aulas e constancia.",
    },
  ],
};

export const teacherSidebarConfig: SidebarConfig = {
  badge: "Painel do Professor",
  title: "Portal dos Estudos Espiritas Online",
  description: "Planejamento da aula, revisao do conteudo e publicacao com cuidado humano.",
  footerTitle: "Revisao antes de publicar",
  footerDescription:
    "O professor sempre revisa roteiro, perguntas e resumo antes de compartilhar com o grupo.",
  navLabel: "Navegacao do painel do professor",
  items: [
    {
      type: "section",
      targetId: "professor-inicio",
      label: "Inicio",
      description: "Voltar ao topo do painel do professor.",
    },
    {
      type: "section",
      targetId: "professor-grupo-emmanuel",
      label: "Emmanuel",
      description: "Ir ao card do grupo Emmanuel.",
    },
    {
      type: "section",
      targetId: "professor-grupo-a-caminho-da-luz",
      label: "A Caminho da Luz",
      description: "Ir ao card do grupo A Caminho da Luz.",
    },
    {
      type: "section",
      targetId: "professor-duvidas",
      label: "Duvidas",
      description: "Revisar as duvidas recebidas da turma.",
    },
    {
      type: "section",
      targetId: "professor-resumos",
      label: "Resumos",
      description: "Ver a previa do conteudo e do resumo da aula.",
    },
    {
      type: "section",
      targetId: "professor-configuracoes",
      label: "Configuracoes",
      description: "Conferir aprovacao, rascunho e publicacao final.",
    },
  ],
};

export const pageMeta = {
  "/": {
    title: "Inicio",
    description: "Projeto demonstrativo para apoiar grupos de estudos online.",
  },
  "/portal": {
    title: "Portal",
    description: "Panorama acolhedor dos grupos, encontros e proximos passos.",
  },
  "/aluno": {
    title: "Painel do Aluno",
    description: "Encontros, materiais, assistente e progresso em um so lugar.",
  },
  "/professor": {
    title: "Painel do Professor",
    description: "Planejamento da semana, revisao de conteudo e publicacao consciente.",
  },
} satisfies Record<string, { title: string; description: string }>;
