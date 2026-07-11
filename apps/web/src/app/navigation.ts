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
      to: "/educacao-continuada",
      label: "Educacao continuada",
      description: "Entrada publica para visitantes que chegam pelo QR Code do cartaz.",
    },
    {
      type: "route",
      to: "/inscricao",
      label: "Inscricao",
      description: "Formulario simples de interesse para novos participantes.",
    },
    {
      type: "route",
      to: "/divulgacao",
      label: "Divulgacao",
      description: "Orientacao para o professor usar a pagina certa no QR Code do cartaz.",
    },
    {
      type: "route",
      to: "/aluno",
      label: "Aluno",
      description: "Aulas, materiais, resumos, duvidas e progresso.",
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
      description: "Ver materiais de apoio, resumos e leitura recomendada do livro selecionado.",
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
    title: "Inicio",
    description: "Projeto demonstrativo para apoiar grupos de estudos online.",
  },
  "/portal": {
    title: "Portal",
    description: "Panorama acolhedor dos grupos, encontros e proximos passos.",
  },
  "/educacao-continuada": {
    title: "Educacao Continuada Online",
    description: "Entrada publica para novos participantes conhecerem os grupos e o proximo passo.",
  },
  "/inscricao": {
    title: "Inscricao",
    description: "Cadastro simples de interesse para os estudos online.",
  },
  "/divulgacao": {
    title: "Divulgacao do QR Code",
    description: "Orientacao simples para divulgar o QR Code sem expor o encontro.",
  },
  "/aluno": {
    title: "Painel do Aluno",
    description: "Encontros, materiais, assistente e progresso em um so lugar.",
  },
  "/materiais": {
    title: "Materiais dos Livros",
    description: "Biblioteca simples com arquivos curtos para alunos e professores.",
  },
  "/materiais/emmanuel": {
    title: "Materiais de Emmanuel",
    description: "Arquivos curtos, tags e duvidas frequentes do grupo Emmanuel.",
  },
  "/materiais/a-caminho-da-luz": {
    title: "Materiais de A Caminho da Luz",
    description: "Arquivos curtos, tags e duvidas frequentes do grupo A Caminho da Luz.",
  },
  "/professor": {
    title: "Painel do Professor",
    description: "Planejamento da semana, revisao de conteudo e publicacao consciente.",
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
      label: "Enviar duvida",
    },
    {
      targetId: "portal-orientacoes",
      label: "Orientacoes",
    },
  ],
  "/educacao-continuada": [
    {
      targetId: "educacao-continuada-inicio",
      label: "Inicio",
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
      label: "Proximo passo",
    },
  ],
  "/inscricao": [
    {
      targetId: "inscricao-inicio",
      label: "Inicio",
    },
    {
      targetId: "inscricao-formulario",
      label: "Formulario",
    },
  ],
  "/divulgacao": [
    {
      targetId: "divulgacao-inicio",
      label: "Inicio",
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
      label: "Acessos rapidos",
    },
  ],
  "/aluno": [
    {
      targetId: "aluno-inicio",
      label: "Inicio",
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
      label: "Proxima aula",
      navTargetId: "aluno-inicio",
    },
    {
      targetId: "aluno-duvidas",
      label: "Duvidas",
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
      label: "Duvidas frequentes",
    },
    {
      targetId: "materiais-aviso",
      label: "Revisao humana",
    },
  ],
  "/materiais/a-caminho-da-luz": [
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
      label: "Duvidas frequentes",
    },
    {
      targetId: "materiais-aviso",
      label: "Revisao humana",
    },
  ],
  "/professor": [
    {
      targetId: "professor-inicio",
      label: "Inicio",
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
      label: "Duvidas",
    },
    {
      targetId: "professor-resumos",
      label: "Previa",
    },
    {
      targetId: "professor-configuracoes",
      label: "Aprovacao",
    },
  ],
};
