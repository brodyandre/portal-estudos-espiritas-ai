import type { GroupSlug } from "./index";

export type KnowledgeFileType = "tema" | "capitulo" | "faq" | "palavras_chave" | "visao_geral";

export interface KnowledgeSupportFile {
  id: string;
  title: string;
  filename: string;
  path: string;
  groupSlug: GroupSlug;
  groupName: string;
  bookTitle: string;
  type: KnowledgeFileType;
  typeLabel: string;
  tags: string[];
  summary: string;
  teacherReviewRecommended: boolean;
  sensitiveTopics: string[];
  actionLabel: "Ver resumo" | "Usar como apoio";
}

export interface MockKnowledgeGroup {
  groupSlug: GroupSlug;
  groupName: string;
  bookTitle: string;
  objective: string;
  mainKeywords: string[];
  faqTitles: string[];
}

const typeLabels: Record<KnowledgeFileType, string> = {
  tema: "Tema",
  capitulo: "Capitulo",
  faq: "FAQ",
  palavras_chave: "Palavras-chave",
  visao_geral: "Visao geral",
};

const actionLabels: Record<KnowledgeFileType, "Ver resumo" | "Usar como apoio"> = {
  tema: "Ver resumo",
  capitulo: "Ver resumo",
  faq: "Usar como apoio",
  palavras_chave: "Usar como apoio",
  visao_geral: "Ver resumo",
};

const createKnowledgeFile = (
  file: Omit<KnowledgeSupportFile, "typeLabel" | "actionLabel">,
): KnowledgeSupportFile => {
  return {
    ...file,
    typeLabel: typeLabels[file.type],
    actionLabel: actionLabels[file.type],
  };
};

export const mockKnowledgeGroups: MockKnowledgeGroup[] = [
  {
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    objective:
      "Apoiar o estudo com constancia, escuta respeitosa e aplicacao pratica no dia a dia.",
    mainKeywords: ["constancia", "estudo sereno", "escuta", "evangelho", "mediunidade"],
    faqTitles: ["Emmanuel - duvidas frequentes"],
  },
  {
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    objective:
      "Apoiar a leitura com prudencia, boa convivencia e perguntas serenas sobre historia espiritual.",
    mainKeywords: ["capela", "evangelho", "historia espiritual", "futuro", "civilizacoes"],
    faqTitles: ["A Caminho da Luz - duvidas frequentes"],
  },
];

export const mockKnowledgeFiles: KnowledgeSupportFile[] = [
  createKnowledgeFile({
    id: "mock-emmanuel-visao-geral",
    title: "Emmanuel - visao geral",
    filename: "emmanuel_visao_geral.md",
    path: "data/knowledge/emmanuel/emmanuel_visao_geral.md",
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    type: "visao_geral",
    tags: ["emmanuel", "visao geral", "estudo em grupo", "leitura calma", "pratica"],
    summary:
      "Panorama curto para lembrar que o estudo do grupo cresce com regularidade, boa vontade e aplicacao serena no cotidiano.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
  createKnowledgeFile({
    id: "mock-emmanuel-constancia",
    title: "Emmanuel - constancia no estudo",
    filename: "emmanuel_tema_constancia.md",
    path: "data/knowledge/emmanuel/emmanuel_tema_constancia.md",
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    type: "tema",
    tags: ["constancia", "regularidade", "perseveranca", "rotina", "revisao"],
    summary:
      "Resumo curto sobre continuar estudando com pequenos passos, mesmo quando a semana estiver corrida ou o animo mais baixo.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
  createKnowledgeFile({
    id: "mock-emmanuel-aplicacao-pratica",
    title: "Emmanuel - aplicacao pratica",
    filename: "emmanuel_tema_aplicacao_pratica.md",
    path: "data/knowledge/emmanuel/emmanuel_tema_aplicacao_pratica.md",
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    type: "tema",
    tags: ["evangelho", "vida diaria", "atitude concreta", "esforco proprio", "cotidiano"],
    summary:
      "Resumo curto sobre levar o estudo para atitudes concretas, com simplicidade, paciencia e responsabilidade no dia a dia.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
  createKnowledgeFile({
    id: "mock-emmanuel-capitulo-01",
    title: "Emmanuel - capitulo 1 - almas enfraquecidas",
    filename: "emmanuel_capitulo_01.md",
    path: "data/knowledge/emmanuel/emmanuel_capitulo_01.md",
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    type: "capitulo",
    tags: ["acolhimento", "fragilidade", "sofrimento", "prudencia", "escuta"],
    summary:
      "Resumo curto sobre acolher fragilidades sem pressa, com escuta respeitosa e cuidado ao tratar sofrimento e experiencias delicadas.",
    teacherReviewRecommended: true,
    sensitiveTopics: ["sofrimento", "mediunidade", "conflitos pessoais"],
  }),
  createKnowledgeFile({
    id: "mock-emmanuel-faq",
    title: "Emmanuel - duvidas frequentes",
    filename: "emmanuel_duvidas_frequentes.md",
    path: "data/knowledge/emmanuel/emmanuel_duvidas_frequentes.md",
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    type: "faq",
    tags: ["faq", "duvidas comuns", "professor", "revisao humana", "grupo"],
    summary:
      "Bloco curto com perguntas recorrentes sobre desanimo, esforco proprio, mediunidade e convivencia fraterna, sempre com convite para revisao humana.",
    teacherReviewRecommended: true,
    sensitiveTopics: ["mediunidade", "reencarnacao", "conflitos pessoais"],
  }),
  createKnowledgeFile({
    id: "mock-emmanuel-keywords",
    title: "Emmanuel - palavras-chave principais",
    filename: "emmanuel_palavras_chave.md",
    path: "data/knowledge/emmanuel/emmanuel_palavras_chave.md",
    groupSlug: "emmanuel",
    groupName: "Emmanuel",
    bookTitle: "Emmanuel",
    type: "palavras_chave",
    tags: ["constancia", "evangelho", "esforco proprio", "mediunidade", "convivio"],
    summary:
      "Lista curta de palavras-chave para facilitar buscas e perguntas naturais dentro do grupo Emmanuel.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
  createKnowledgeFile({
    id: "mock-acl-visao-geral",
    title: "A Caminho da Luz - visao geral",
    filename: "a_caminho_da_luz_visao_geral.md",
    path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_visao_geral.md",
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    type: "visao_geral",
    tags: ["visao geral", "historia espiritual", "prudencia", "grupo", "leitura"],
    summary:
      "Panorama curto para apresentar a obra como apoio de estudo, com leitura prudente, respeito e foco educativo.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
  createKnowledgeFile({
    id: "mock-acl-historia-espiritual",
    title: "A Caminho da Luz - historia espiritual da humanidade",
    filename: "a_caminho_da_luz_tema_historia_espiritual.md",
    path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_historia_espiritual.md",
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    type: "tema",
    tags: ["historia espiritual", "humanidade", "responsabilidade moral", "prudencia", "evangelho"],
    summary:
      "Resumo curto sobre olhar a historia espiritual com calma, evitando conclusoes fechadas e valorizando a responsabilidade moral.",
    teacherReviewRecommended: true,
    sensitiveTopics: ["futuro", "instituicoes religiosas"],
  }),
  createKnowledgeFile({
    id: "mock-acl-civilizacoes",
    title: "A Caminho da Luz - civilizacoes antigas",
    filename: "a_caminho_da_luz_tema_civilizacoes_antigas.md",
    path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_civilizacoes_antigas.md",
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    type: "tema",
    tags: ["capela", "civilizacoes", "prudencia", "historia", "racas adamicas"],
    summary:
      "Resumo curto sobre civilizacoes antigas, Capela e outras referencias simbolicas, sempre com leitura prudente e sem determinismos.",
    teacherReviewRecommended: true,
    sensitiveTopics: ["Capela", "racas adamicas", "guerras"],
  }),
  createKnowledgeFile({
    id: "mock-acl-jesus-evangelho",
    title: "A Caminho da Luz - Jesus e Evangelho",
    filename: "a_caminho_da_luz_tema_jesus_e_evangelho.md",
    path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_jesus_e_evangelho.md",
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    type: "tema",
    tags: ["evangelho", "jesus", "eixo moral", "vida pratica", "esperanca"],
    summary:
      "Resumo curto sobre o Evangelho como eixo moral do estudo, com foco em atitudes simples, respeito e renovacao interior.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
  createKnowledgeFile({
    id: "mock-acl-faq",
    title: "A Caminho da Luz - duvidas frequentes",
    filename: "a_caminho_da_luz_duvidas_frequentes.md",
    path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_duvidas_frequentes.md",
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    type: "faq",
    tags: ["faq", "capela", "futuro", "prudencia", "professor"],
    summary:
      "Bloco curto com perguntas frequentes sobre Capela, futuro da humanidade, leitura historica e necessidade de prudencia.",
    teacherReviewRecommended: true,
    sensitiveTopics: ["Capela", "racas adamicas", "futuro"],
  }),
  createKnowledgeFile({
    id: "mock-acl-keywords",
    title: "A Caminho da Luz - palavras-chave principais",
    filename: "a_caminho_da_luz_palavras_chave.md",
    path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_palavras_chave.md",
    groupSlug: "a-caminho-da-luz",
    groupName: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    type: "palavras_chave",
    tags: ["capela", "evangelho", "historia espiritual", "civilizacoes", "futuro"],
    summary:
      "Lista curta de palavras-chave para orientar buscas simples e conversas prudentes dentro do grupo A Caminho da Luz.",
    teacherReviewRecommended: false,
    sensitiveTopics: [],
  }),
];

export const listMockKnowledgeFilesByGroup = (groupSlug: GroupSlug): KnowledgeSupportFile[] => {
  return mockKnowledgeFiles.filter((file) => file.groupSlug === groupSlug);
};

export const getMockKnowledgeGroup = (groupSlug: GroupSlug): MockKnowledgeGroup | null => {
  return mockKnowledgeGroups.find((group) => group.groupSlug === groupSlug) ?? null;
};
