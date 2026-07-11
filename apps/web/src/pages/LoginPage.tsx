import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { setCurrentUserRole } from "../mocks/currentUser";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TextInput } from "../components/ui/TextInput";

const localDemoCredentials = [
  {
    title: "Admin local",
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
    description: "Acesso local para dashboard, usuários, grupos, conteúdos e auditoria.",
  },
  {
    title: "Professor local",
    email: "professor.demo@example.com",
    password: "ProfessorDemo@123",
    description: "Acesso local para revisar interessados e acompanhar a área do professor.",
  },
  {
    title: "Aluno local",
    email: "aluno.demo@example.com",
    password: "AlunoDemo@123",
    description: "Acesso local para abrir a área do aluno e ver o link da aula autorizado.",
  },
] as const;

const demoProfiles = [
  { label: "Público", role: "visitor" as const, to: "/portal" },
  { label: "Aluno", role: "student" as const, to: "/aluno" },
  { label: "Professor", role: "teacher" as const, to: "/professor" },
  { label: "Admin", role: "admin" as const, to: "/admin/dashboard" },
] as const;

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isDemoMode, isLoading, login, notice, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTarget = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return (
      state?.from?.pathname ??
      (user?.role === "admin"
        ? "/admin/dashboard"
        : user?.role === "teacher"
          ? "/professor"
          : "/aluno")
    );
  }, [location.state, user?.role]);

  if (isAuthenticated && !isLoading) {
    return <Navigate replace to={redirectTarget} />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isDemoMode) {
      setErrorMessage("O login real funciona apenas no ambiente local com backend.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email, password);
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível concluir o login local.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Acesso local"
        description="Use o ambiente local para entrar com um perfil real de Admin, Professor ou Aluno. No GitHub Pages, esta tela continua apenas como demonstração segura."
        eyebrow="Login"
        meta={[
          { label: "Modo atual", value: isDemoMode ? "Demonstração" : "Local" },
          { label: "Backend", value: isDemoMode ? "Não conectado" : "Obrigatório" },
        ]}
        title="Entrar no portal"
      />

      {notice ? (
        <AlertBox title="Aviso do ambiente" tone="info">
          {notice}
        </AlertBox>
      ) : null}

      {errorMessage ? (
        <AlertBox title="Não foi possível entrar" tone="warning">
          {errorMessage}
        </AlertBox>
      ) : null}

      <div className="two-column-grid">
        <Card tone="default">
          <p className="card-eyebrow">Login local</p>
          <h2>Use e-mail e senha</h2>
          <p className="student-panel__note">
            {isDemoMode
              ? "Nesta versão pública, o formulário não autentica usuários reais."
              : "As credenciais abaixo foram preparadas para a máquina local com backend e PostgreSQL."}
          </p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <TextInput
              autoComplete="email"
              id="login-email"
              label="E-mail"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              required
              type="email"
              value={email}
            />
            <TextInput
              autoComplete="current-password"
              id="login-password"
              label="Senha"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              required
              type="password"
              value={password}
            />
            <div className="button-row">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
              <Button to="/portal" variant="secondary">
                Voltar ao portal
              </Button>
            </div>
          </form>
        </Card>

        <Card tone="soft">
          <p className="card-eyebrow">{isDemoMode ? "Perfis demonstrativos" : "Credenciais demonstrativas"}</p>
          <h2>{isDemoMode ? "Escolha um perfil demo" : "Perfis locais para teste"}</h2>
          <div className="stack-list">
            {isDemoMode
              ? demoProfiles.map((profile) => (
                  <div className="support-card" key={profile.role}>
                    <h3>{profile.label}</h3>
                    <p className="student-panel__note">
                      Ativa um perfil demonstrativo seguro para revisar a navegação no GitHub Pages.
                    </p>
                    <Button
                      onClick={() => {
                        setCurrentUserRole(profile.role);
                        navigate(profile.to);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Usar perfil {profile.label}
                    </Button>
                  </div>
                ))
              : localDemoCredentials.map((credential) => (
                  <div className="support-card" key={credential.email}>
                    <h3>{credential.title}</h3>
                    <p className="student-panel__note">{credential.description}</p>
                    <p className="student-panel__note">
                      <strong>E-mail:</strong> {credential.email}
                      <br />
                      <strong>Senha:</strong> {credential.password}
                    </p>
                    <Button
                      onClick={() => {
                        setEmail(credential.email);
                        setPassword(credential.password);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Preencher credenciais
                    </Button>
                  </div>
                ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
