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

export interface PageSectionContext {
  targetId: string;
  label: string;
  navTargetId?: string;
}

export const appSidebarConfig: SidebarConfig = {
  badge: "Projeto demonstrativo",
  title: "Educação Continuada",
  description: "Programa acolhedor para encontros online via Google Meet.",
  footerTitle: "Apoio com revisão humana",
  footerDescription:
    "A plataforma ajuda a estudar, organizar materiais e preparar encontros, mas não substitui professores.",
  navLabel: "Navegação principal",
  items: [
    {
      type: "route",
      to: "/",
      label: "Início",
      description: "Visão geral do projeto e grupos em destaque.",
    },
    {
      type: "route",
      to: "/portal",
      label: "Portal",
      description: "Panorama geral dos encontros e acessos principais.",
    },
    {
      type: "route",
      to: "/educacao-continuada",
      label: "Educação continuada",
      description: "Entrada pública para visitantes que chegam pelo QR Code do cartaz.",
    },
    {
      type: "route",
      to: "/inscricao",
      label: "Inscrição",
      description: "Formulário simples de interesse para novos participantes.",
    },
    {
      type: "route",
      to: "/divulgacao",
      label: "Divulgação",
      description: "Orientação para o professor usar a página certa no QR Code do cartaz.",
    },
    {
      type: "route",
      to: "/aluno",
      label: "Aluno",
      description: "Aulas, materiais, resumos, dúvidas e progresso.",
    },
    {
      type: "route",
      to: "/materiais",
      label: "Materiais",
      description: "Biblioteca simples com os livros, arquivos e duvidas frequentes.",
    },
    {
      type: "route",
      to: "/professor",
      label: "Professor",
      description: "Planejamento, revisão e publicação do encontro.",
    },
  ],
};

export const studentSidebarConfig: SidebarConfig = {
  badge: "Painel do Aluno",
  title: "Educação Continuada",
  description: "Acesso simples a encontros, materiais, dúvidas e progresso.",
  footerTitle: "Estudo com apoio humano",
  footerDescription:
    "O assistente ajuda na revisão do estudo, mas a orientação do professor continua essencial.",
  navLabel: "Navegação do painel do aluno",
  items: [
    {
      type: "section",
      targetId: "aluno-inicio",
      label: "Início",
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
      description: "Ver materiais de apoio, resumos e leitura recomendada do livro selecionado.",
    },
    {
      type: "section",
      targetId: "duvidas-enviadas",
      label: "Dúvidas",
      description: "Revisar perguntas enviadas e resposta do assistente.",
    },
    {
      type: "section",
      targetId: "meu-progresso",
      label: "Meu progresso",
      description: "Acompanhar presenca, aulas e constancia.",
    },
    {
      type: "route",
      to: "/materiais",
      label: "Materiais dos livros",
      description: "Abrir a biblioteca com resumos curtos e arquivos do estudo.",
    },
  ],
};

export const teacherSidebarConfig: SidebarConfig = {
  badge: "Painel do Professor",
  title: "Educação Continuada",
  description: "Planejamento da aula, revisão do conteúdo e publicação com cuidado humano.",
  footerTitle: "Revisão antes de publicar",
  footerDescription:
    "O professor sempre revisa roteiro, perguntas e resumo antes de compartilhar com o grupo.",
  navLabel: "Navegação do painel do professor",
  items: [
    {
      type: "section",
      targetId: "professor-inicio",
      label: "Início",
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
      label: "Dúvidas",
      description: "Revisar as dúvidas recebidas da turma.",
    },
    {
      type: "section",
      targetId: "professor-resumos",
      label: "Resumos",
      description: "Ver a prévia do conteúdo e do resumo da aula.",
    },
    {
      type: "section",
      targetId: "professor-configuracoes",
      label: "Configurações",
      description: "Conferir aprovação, rascunho e publicação final.",
    },
    {
      type: "route",
      to: "/materiais",
      label: "Materiais dos livros",
      description: "Abrir a biblioteca com a base de apoio dos grupos.",
    },
  ],
};

export const pageMeta = {
  "/": {
    title: "Início",
    description: "Projeto demonstrativo para apoiar grupos de estudos online.",
  },
  "/portal": {
    title: "Portal",
    description: "Panorama acolhedor dos grupos, encontros e próximos passos.",
  },
  "/educacao-continuada": {
    title: "Educação Continuada Online",
    description: "Entrada pública para novos participantes conhecerem os grupos e o próximo passo.",
  },
  "/inscricao": {
    title: "Inscrição",
    description: "Cadastro simples de interesse para os estudos online.",
  },
  "/divulgacao": {
    title: "Divulgação do QR Code",
    description: "Orientação simples para divulgar o QR Code sem expor o encontro.",
  },
  "/aluno": {
    title: "Painel do Aluno",
    description: "Encontros, materiais, assistente e progresso em um só lugar.",
  },
  "/materiais": {
    title: "Materiais dos Livros",
    description: "Biblioteca simples com arquivos curtos para alunos e professores.",
  },
  "/materiais/emmanuel": {
    title: "Materiais de Emmanuel",
    description: "Arquivos curtos, tags e dúvidas frequentes do grupo Emmanuel.",
  },
  "/materiais/a-caminho-da-luz": {
    title: "Materiais de A Caminho da Luz",
    description: "Arquivos curtos, tags e dúvidas frequentes do grupo A Caminho da Luz.",
  },
  "/professor": {
    title: "Painel do Professor",
    description: "Planejamento da semana, revisão de conteúdo e publicação consciente.",
  },
} satisfies Record<string, { title: string; description: string }>;

export const pageSections: Record<string, PageSectionContext[]> = {
  "/": [],
  "/portal": [
    {
      targetId: "portal-inicio",
      label: "Boas-vindas",
    },
    {
      targetId: "portal-grupos",
      label: "Grupos e Google Meet",
    },
    {
      targetId: "portal-tema",
      label: "Tema da semana",
    },
    {
      targetId: "portal-materiais",
      label: "Materiais",
    },
    {
      targetId: "portal-duvidas",
      label: "Enviar dúvida",
    },
    {
      targetId: "portal-orientacoes",
      label: "Orientações",
    },
  ],
  "/educacao-continuada": [
    {
      targetId: "educacao-continuada-inicio",
      label: "Início",
    },
    {
      targetId: "educacao-continuada-proposta",
      label: "Proposta",
    },
    {
      targetId: "educacao-continuada-grupos",
      label: "Grupos",
    },
    {
      targetId: "educacao-continuada-acoes",
      label: "Próximo passo",
    },
  ],
  "/inscricao": [
    {
      targetId: "inscricao-inicio",
      label: "Início",
    },
    {
      targetId: "inscricao-formulario",
      label: "Formulário",
    },
  ],
  "/divulgacao": [
    {
      targetId: "divulgacao-inicio",
      label: "Início",
    },
    {
      targetId: "divulgacao-orientacao",
      label: "URL recomendada",
    },
    {
      targetId: "divulgacao-cartaz",
      label: "Texto do cartaz",
    },
    {
      targetId: "divulgacao-motivos",
      label: "Motivos",
    },
    {
      targetId: "divulgacao-acoes",
      label: "Acessos rápidos",
    },
  ],
  "/aluno": [
    {
      targetId: "aluno-inicio",
      label: "Início",
    },
    {
      targetId: "grupo-emmanuel",
      label: "Emmanuel",
    },
    {
      targetId: "grupo-a-caminho-da-luz",
      label: "A Caminho da Luz",
    },
    {
      targetId: "aluno-proxima-aula",
      label: "Próxima aula",
      navTargetId: "aluno-inicio",
    },
    {
      targetId: "aluno-duvidas",
      label: "Dúvidas",
      navTargetId: "duvidas-enviadas",
    },
    {
      targetId: "materiais-da-semana",
      label: "Materiais de apoio",
    },
    {
      targetId: "aluno-resumo",
      label: "Resumo",
      navTargetId: "materiais-da-semana",
    },
    {
      targetId: "meu-progresso",
      label: "Progresso",
    },
  ],
  "/materiais": [
    {
      targetId: "materiais-inicio",
      label: "Inicio",
    },
    {
      targetId: "materiais-grupos",
      label: "Livros",
    },
    {
      targetId: "materiais-aviso",
      label: "Revisao humana",
    },
  ],
  "/materiais/emmanuel": [
    {
      targetId: "materiais-inicio",
      label: "Inicio",
    },
    {
      targetId: "materiais-arquivos",
      label: "Arquivos",
    },
    {
      targetId: "materiais-duvidas",
      label: "Dúvidas frequentes",
    },
    {
      targetId: "materiais-aviso",
      label: "Revisão humana",
    },
  ],
  "/materiais/a-caminho-da-luz": [
    {
      targetId: "materiais-inicio",
      label: "Início",
    },
    {
      targetId: "materiais-arquivos",
      label: "Arquivos",
    },
    {
      targetId: "materiais-duvidas",
      label: "Dúvidas frequentes",
    },
    {
      targetId: "materiais-aviso",
      label: "Revisão humana",
    },
  ],
  "/professor": [
    {
      targetId: "professor-inicio",
      label: "Início",
    },
    {
      targetId: "professor-grupo-emmanuel",
      label: "Emmanuel",
    },
    {
      targetId: "professor-grupo-a-caminho-da-luz",
      label: "A Caminho da Luz",
    },
    {
      targetId: "professor-preparar-aula",
      label: "Preparar aula",
      navTargetId: "professor-inicio",
    },
    {
      targetId: "professor-duvidas",
      label: "Dúvidas",
    },
    {
      targetId: "professor-resumos",
      label: "Prévia",
    },
    {
      targetId: "professor-configuracoes",
      label: "Aprovação",
    },
  ],
};
