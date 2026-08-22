import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DemoGroup } from "../mocks";

const studiesServiceMock = vi.hoisted(() => ({
  listStudies: vi.fn(),
}));

vi.mock("../services/studiesService", () => ({
  listStudies: studiesServiceMock.listStudies,
}));

const demoLeakPatterns = [
  "88 participantes",
  "62 participantes",
  "Segunda-feira",
  "Quarta-feira",
  "20h",
  "Segunda, 13 de julho de 2026, 20h",
  "Quarta, 15 de julho de 2026, 20h",
  "https://example.com/demo-meet/emmanuel",
  "https://example.com/demo-meet/a-caminho-da-luz",
];

const productionGroups: DemoGroup[] = [
  {
    slug: "emmanuel",
    name: "Emmanuel",
    meetingDay: null,
    meetingTime: null,
    participantCount: null,
    bookTitle: "Emmanuel",
    meetUrl: null,
    description: null,
    nextLesson: null,
  },
  {
    slug: "a-caminho-da-luz",
    name: "A Caminho da Luz",
    meetingDay: null,
    meetingTime: null,
    participantCount: null,
    bookTitle: "A Caminho da Luz",
    meetUrl: null,
    description: null,
    nextLesson: null,
  },
];

const loadHomeTestModules = async () => {
  const { HomePage } = await import("../pages/HomePage");

  return {
    HomePage,
    listStudiesMock: studiesServiceMock.listStudies,
  };
};

const renderHome = (HomePage: Awaited<ReturnType<typeof loadHomeTestModules>>["HomePage"]) => {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
    >
      <HomePage />
    </MemoryRouter>,
  );
};

const expectNoDemoOperationalData = () => {
  for (const text of demoLeakPatterns) {
    expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(text);
  }

  expect(screen.queryByRole("link", { name: "Entrar no encontro" })).not.toBeInTheDocument();
};

describe("HomePage production studies source", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renderiza grupos da API sem inventar dados operacionais nulos", async () => {
    const { HomePage, listStudiesMock } = await loadHomeTestModules();
    listStudiesMock.mockResolvedValue({
      data: productionGroups,
      source: "api",
      notice: null,
    });

    renderHome(HomePage);

    expect(await screen.findByRole("heading", { level: 3, name: "Emmanuel" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 3, name: "A Caminho da Luz" }),
    ).toBeInTheDocument();
    expectNoDemoOperationalData();
  });

  it("exibe indisponibilidade terminal quando a API falha em runtime production-like", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("BASE_URL", "/");
    vi.stubEnv("VITE_APP_MODE", "local");
    vi.stubEnv("VITE_API_URL", "https://api.portal-educacao-continuada.com.br");
    const { HomePage, listStudiesMock } = await loadHomeTestModules();
    listStudiesMock.mockRejectedValue(new Error("backend offline"));

    renderHome(HomePage);

    expect(await screen.findByText("Grupos temporariamente indisponiveis")).toBeInTheDocument();
    expectNoDemoOperationalData();
  });

  it("mantem loading governado sem renderizar cards demonstrativos", async () => {
    const { HomePage, listStudiesMock } = await loadHomeTestModules();
    listStudiesMock.mockReturnValue(new Promise(() => undefined));

    renderHome(HomePage);

    expect(screen.getByText("Carregando grupos")).toBeInTheDocument();
    expectNoDemoOperationalData();
  });

  it("exibe estado vazio terminal sem recorrer a mocks", async () => {
    const { HomePage, listStudiesMock } = await loadHomeTestModules();
    listStudiesMock.mockResolvedValue({
      data: [],
      source: "api",
      notice: null,
    });

    renderHome(HomePage);

    expect(await screen.findByText("Nenhum grupo disponivel")).toBeInTheDocument();
    expectNoDemoOperationalData();
  });
});
