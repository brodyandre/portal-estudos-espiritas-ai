import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeSupportFile } from "../services/knowledgeService";
import type { StudyGroup } from "../types/studyGroup";

const servicesMock = vi.hoisted(() => ({
  listStudies: vi.fn(),
  listKnowledgeFilesByGroup: vi.fn(),
}));

vi.mock("../services/studiesService", () => ({
  listStudies: servicesMock.listStudies,
}));

vi.mock("../services/knowledgeService", () => ({
  getPublicKnowledgeGroupId: (groupId: string) => {
    if (groupId === "emmanuel") {
      return "emmanuel";
    }

    if (groupId === "a-caminho-da-luz") {
      return "a_caminho_da_luz";
    }

    return null;
  },
  listKnowledgeFilesByGroup: servicesMock.listKnowledgeFilesByGroup,
}));

const emmanuelStudy: StudyGroup = {
  slug: "emmanuel",
  name: "Emmanuel",
  meetingDay: null,
  meetingTime: null,
  participantCount: null,
  meetUrl: null,
  bookTitle: "Emmanuel",
  description: "Grupo Emmanuel",
  nextLesson: null,
};

const caminhoStudy: StudyGroup = {
  slug: "a-caminho-da-luz",
  name: "A Caminho da Luz",
  meetingDay: null,
  meetingTime: null,
  participantCount: null,
  meetUrl: null,
  bookTitle: "A Caminho da Luz",
  description: "Grupo A Caminho da Luz",
  nextLesson: null,
};

const obrasStudy: StudyGroup = {
  slug: "obras-postumas",
  name: "Grupo Obras Póstumas",
  meetingDay: "Quarta-feira",
  meetingTime: "20:00",
  participantCount: 12,
  meetUrl: null,
  bookTitle: "Obras Póstumas",
  description: "Grupo sintético de teste",
  nextLesson: null,
};

const knowledgeFile = (groupSlug: string, title: string): KnowledgeSupportFile => ({
  id: `file-${groupSlug}`,
  title,
  filename: `${groupSlug}.md`,
  path: `data/knowledge/${groupSlug}.md`,
  groupSlug,
  groupName: title,
  bookTitle: title,
  type: "visao_geral",
  typeLabel: "Visao geral",
  tags: ["estudo"],
  summary: `Resumo ${title}`,
  teacherReviewRecommended: false,
  sensitiveTopics: [],
  actionLabel: "Ver resumo",
});

const mockStudies = (groups: StudyGroup[]) => {
  servicesMock.listStudies.mockResolvedValue({
    data: groups,
    source: "api",
    notice: null,
  });
};

const mockKnowledge = () => {
  servicesMock.listKnowledgeFilesByGroup.mockImplementation(async (groupSlug: string) => ({
    data:
      groupSlug === "obras-postumas"
        ? []
        : [knowledgeFile(groupSlug, groupSlug === "emmanuel" ? "Arquivo Emmanuel" : "Arquivo A Caminho")],
    source: "api",
    notice: null,
  }));
};

const renderMaterials = async (path: string) => {
  const { MaterialsPage } = await import("../pages/MaterialsPage");

  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
      initialEntries={[path]}
    >
      <Routes>
        <Route element={<MaterialsPage />} path="/materiais" />
        <Route element={<MaterialsPage />} path="/materiais/:groupSlug" />
      </Routes>
    </MemoryRouter>,
  );
};

describe("MaterialsPage dynamic public routes", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("mantém /materiais/emmanuel funcionando com Knowledge suportado", async () => {
    mockStudies([emmanuelStudy, caminhoStudy, obrasStudy]);
    mockKnowledge();

    await renderMaterials("/materiais/emmanuel");

    expect(await screen.findByRole("heading", { name: "Materiais de Emmanuel" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Arquivo Emmanuel" })).toBeInTheDocument();
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledWith("emmanuel");
    expect(servicesMock.listKnowledgeFilesByGroup).not.toHaveBeenCalledWith("a-caminho-da-luz");
    expect(servicesMock.listKnowledgeFilesByGroup).not.toHaveBeenCalledWith("obras-postumas");
  });

  it("mantém /materiais/a-caminho-da-luz funcionando com Knowledge suportado", async () => {
    mockStudies([emmanuelStudy, caminhoStudy, obrasStudy]);
    mockKnowledge();

    await renderMaterials("/materiais/a-caminho-da-luz");

    expect(
      await screen.findByRole("heading", { name: "Materiais de A Caminho da Luz" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Arquivo A Caminho" })).toBeInTheDocument();
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledWith("a-caminho-da-luz");
    expect(servicesMock.listKnowledgeFilesByGroup).not.toHaveBeenCalledWith("emmanuel");
    expect(servicesMock.listKnowledgeFilesByGroup).not.toHaveBeenCalledWith("obras-postumas");
  });

  it("abre /materiais/obras-postumas quando o grupo existe em /api/studies", async () => {
    mockStudies([emmanuelStudy, caminhoStudy, obrasStudy]);
    mockKnowledge();

    await renderMaterials("/materiais/obras-postumas");

    expect(
      await screen.findByRole("heading", { name: "Materiais de Grupo Obras Póstumas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Grupo sintético de teste")).toBeInTheDocument();
    expect(screen.queryByText("Material nao encontrado")).not.toBeInTheDocument();
    expect(screen.getByText("Ainda não há materiais públicos disponíveis para este livro.")).toBeInTheDocument();
    expect(screen.getByText("Materiais em preparação")).toBeInTheDocument();
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledTimes(1);
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledWith("obras-postumas");
    expect(screen.queryByText("Arquivo Emmanuel")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivo A Caminho")).not.toBeInTheDocument();
  });

  it("mostra not-found verdadeiro apenas quando /api/studies não contém o slug", async () => {
    mockStudies([emmanuelStudy, caminhoStudy]);
    mockKnowledge();

    await renderMaterials("/materiais/grupo-inexistente");

    expect(await screen.findByText("Material nao encontrado")).toBeInTheDocument();
    expect(servicesMock.listKnowledgeFilesByGroup).not.toHaveBeenCalled();
  });

  it("não mostra falso 404 quando o catálogo público falha", async () => {
    servicesMock.listStudies.mockRejectedValue(new Error("studies offline"));
    mockKnowledge();

    await renderMaterials("/materiais/obras-postumas");

    expect(await screen.findByText("Materiais indisponíveis")).toBeInTheDocument();
    expect(screen.queryByText("Material nao encontrado")).not.toBeInTheDocument();
    expect(servicesMock.listKnowledgeFilesByGroup).not.toHaveBeenCalled();
  });

  it("lista todos os StudyGroups públicos e mantém link dinâmico para o terceiro grupo", async () => {
    mockStudies([emmanuelStudy, caminhoStudy, obrasStudy]);
    mockKnowledge();

    await renderMaterials("/materiais");

    expect(await screen.findByRole("heading", { name: "Emmanuel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A Caminho da Luz" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Grupo Obras Póstumas" })).toBeInTheDocument();
    expect(screen.getByText("3 grupos")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Ver materiais" }).map((link) => link.getAttribute("href")),
    ).toContain("/materiais/obras-postumas");
    expect(screen.getByText("Materiais em preparação")).toBeInTheDocument();

    await waitFor(() => {
      expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledTimes(3);
    });
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledWith("emmanuel");
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledWith("a-caminho-da-luz");
    expect(servicesMock.listKnowledgeFilesByGroup).toHaveBeenCalledWith("obras-postumas");
  });
});
