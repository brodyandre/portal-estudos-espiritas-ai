import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const productionEnv = {
  MODE: "production",
  BASE_URL: "/",
  VITE_APP_MODE: "local",
  VITE_API_URL: "https://api.portal-educacao-continuada.com.br",
  VITE_SHOW_REAL_MEET_LINK: "true",
  VITE_ENABLE_ADMIN_FEATURES: "true",
  VITE_ENABLE_TEACHER_FEATURES: "true",
};

const stubProductionEnv = () => {
  for (const [key, value] of Object.entries(productionEnv)) {
    vi.stubEnv(key, value);
  }
};

const renderPage = async (
  path: string,
  page: "home" | "portal" | "educacao-continuada" | "aluno" | "professor" | "admin",
) => {
  vi.resetModules();
  stubProductionEnv();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("backend offline");
    }),
  );

  if (page === "aluno") {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
  }

  const [
    { AuthProvider },
    { HomePage },
    { PortalPage },
    { EducationContinuedPage },
    { AlunoPage },
    { ProfessorPage },
    { AdminPage },
  ] = await Promise.all([
    import("../auth/AuthProvider"),
    import("../pages/HomePage"),
    import("../pages/PortalPage"),
    import("../pages/EducationContinuedPage"),
    import("../pages/AlunoPage"),
    import("../pages/ProfessorPage"),
    import("../pages/AdminPage"),
  ]);

  const element =
    page === "home" ? (
      <HomePage />
    ) : page === "portal" ? (
      <PortalPage />
    ) : page === "educacao-continuada" ? (
      <EducationContinuedPage />
    ) : page === "aluno" ? (
      <AlunoPage />
    ) : page === "professor" ? (
      <ProfessorPage />
    ) : (
      <AdminPage section="dashboard" />
    );

  return render(
    <AuthProvider>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
        initialEntries={[path]}
      >
        <Routes>
          <Route element={element} path="*" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

describe("production runtime UX", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("usa microcopy institucional na home production-like", async () => {
    await renderPage("/", "home");

    expect(screen.getByText("Educação Continuada")).toBeInTheDocument();
    expect(screen.getByText("Acesso simples em computador, tablet e celular")).toBeInTheDocument();
    expect(screen.queryByText("Mobile-first real desde 360px")).not.toBeInTheDocument();
    expect(screen.queryByText("Projeto")).not.toBeInTheDocument();
  });

  it("nao renderiza linguagem demo na area publica quando a API de producao falha", async () => {
    await renderPage("/portal", "portal");

    expect(await screen.findByText("Portal indisponível")).toBeInTheDocument();
    expect(screen.queryByText("Modo demonstrativo ativo")).not.toBeInTheDocument();
    expect(screen.queryByText(/dados reais e aprovações/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GitHub Pages/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dados demonstrativos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Resumo demonstrativo/i)).not.toBeInTheDocument();
  });

  it("mantem copy real na entrada publica sem fallback demonstrativo em producao", async () => {
    await renderPage("/educacao-continuada", "educacao-continuada");

    expect(await screen.findByText("Grupos indisponíveis")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Educação Continuada Online" })).toBeInTheDocument();
    expect(screen.queryByText("Modo demonstrativo ativo")).not.toBeInTheDocument();
    expect(screen.queryByText(/versão pública/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/backend local/i)).not.toBeInTheDocument();
  });

  it("nao renderiza aviso demonstrativo no painel do aluno production-like", async () => {
    await renderPage("/aluno", "aluno");

    expect(await screen.findByText("Painel indisponível")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Educação Continuada" })).toBeInTheDocument();
    expect(screen.queryByText("Modo demonstrativo ativo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Agenda demonstrativa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Visualizar como/i)).not.toBeInTheDocument();
  });

  it("nao renderiza blocos de fallback demonstrativo no professor production-like", async () => {
    await renderPage("/professor", "professor");

    expect(await screen.findByText("Painel indisponível")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Educação Continuada" })).toBeInTheDocument();
    expect(screen.queryByText("Modo demonstrativo ativo")).not.toBeInTheDocument();
    expect(screen.queryByText("Fluxo demonstrativo")).not.toBeInTheDocument();
    expect(screen.queryByText("GitHub Pages")).not.toBeInTheDocument();
  });

  it("mantem admin com estado real indisponivel sem copy demo em production-like", async () => {
    await renderPage("/admin/dashboard", "admin");

    expect(await screen.findByText("Dashboard indisponível agora")).toBeInTheDocument();
    expect(screen.queryByText("Modo demonstrativo ativo")).not.toBeInTheDocument();
    expect(screen.queryByText(/dados fictícios/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Visualizar como/i)).not.toBeInTheDocument();
  });
});
