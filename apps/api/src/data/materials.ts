import type { StudyGroupId } from "./studies";

export interface StudyMaterial {
  id: string;
  groupId: StudyGroupId;
  title: string;
  type: "reading" | "summary" | "guide" | "activity";
  lessonId: string | null;
  sourcePath: string | null;
  format: "markdown" | "internal";
  description: string;
  publishedAt: string;
}

export const materials: StudyMaterial[] = [
  {
    id: "material-emmanuel-001",
    groupId: "emmanuel",
    title: "Leitura demonstrativa do grupo Emmanuel",
    type: "reading",
    lessonId: "lesson-emmanuel-2026-07-13",
    sourcePath: "data/knowledge/emmanuel_demo.md",
    format: "markdown",
    description: "Texto curto de apoio para preparar o encontro da semana.",
    publishedAt: "2026-07-09T08:00:00-03:00",
  },
  {
    id: "material-emmanuel-002",
    groupId: "emmanuel",
    title: "Orientacoes gerais do grupo",
    type: "guide",
    lessonId: null,
    sourcePath: "data/knowledge/orientacoes_do_grupo.md",
    format: "markdown",
    description: "Combinados simples para manter o encontro acolhedor e organizado.",
    publishedAt: "2026-07-01T09:00:00-03:00",
  },
  {
    id: "material-emmanuel-003",
    groupId: "emmanuel",
    title: "Resumo breve da ultima aula",
    type: "summary",
    lessonId: "lesson-emmanuel-2026-07-06",
    sourcePath: null,
    format: "internal",
    description: "Sintese curta com os pontos principais do encontro anterior.",
    publishedAt: "2026-07-06T21:25:00-03:00",
  },
  {
    id: "material-emmanuel-004",
    groupId: "emmanuel",
    title: "Atividade da semana",
    type: "activity",
    lessonId: "lesson-emmanuel-2026-07-13",
    sourcePath: null,
    format: "internal",
    description: "Registrar uma ideia pratica e uma duvida para o proximo encontro.",
    publishedAt: "2026-07-09T08:10:00-03:00",
  },
  {
    id: "material-a-caminho-da-luz-001",
    groupId: "a-caminho-da-luz",
    title: "Leitura demonstrativa do grupo A Caminho da Luz",
    type: "reading",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    sourcePath: "data/knowledge/a_caminho_da_luz_demo.md",
    format: "markdown",
    description: "Texto de apoio breve para leitura antes do encontro.",
    publishedAt: "2026-07-09T08:15:00-03:00",
  },
  {
    id: "material-a-caminho-da-luz-002",
    groupId: "a-caminho-da-luz",
    title: "Orientacoes gerais do grupo",
    type: "guide",
    lessonId: null,
    sourcePath: "data/knowledge/orientacoes_do_grupo.md",
    format: "markdown",
    description: "Lembretes sobre participacao, respeito e convivio online.",
    publishedAt: "2026-07-01T09:00:00-03:00",
  },
  {
    id: "material-a-caminho-da-luz-003",
    groupId: "a-caminho-da-luz",
    title: "Resumo breve da ultima aula",
    type: "summary",
    lessonId: "lesson-a-caminho-da-luz-2026-07-08",
    sourcePath: null,
    format: "internal",
    description: "Resumo demonstrativo com linguagem simples para consulta rapida.",
    publishedAt: "2026-07-08T21:20:00-03:00",
  },
  {
    id: "material-a-caminho-da-luz-004",
    groupId: "a-caminho-da-luz",
    title: "Perguntas sugeridas para a semana",
    type: "activity",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    sourcePath: null,
    format: "internal",
    description: "Lista curta de perguntas para ajudar na preparacao da aula.",
    publishedAt: "2026-07-09T08:20:00-03:00",
  },
];
