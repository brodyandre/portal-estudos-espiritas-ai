import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const passwordRules = [
  { id: "length", label: "Pelo menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { id: "upper", label: "Ao menos uma letra maiúscula", test: (value: string) => /[A-Z]/u.test(value) },
  { id: "lower", label: "Ao menos uma letra minúscula", test: (value: string) => /[a-z]/u.test(value) },
  { id: "digit", label: "Ao menos um número", test: (value: string) => /\d/u.test(value) },
] as const;

const getRedirectTargetByRole = (role: "student" | "teacher" | "admin" | "visitor" | undefined) => {
  if (role === "admin") {
    return "/admin/dashboard";
  }

  if (role === "teacher") {
    return "/professor";
  }

  return "/aluno";
};

export const PasswordChangePage = () => {
  const navigate = useNavigate();
  const { changePassword, isAuthenticated, isDemoMode, logout, requiresPasswordChange, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTarget = useMemo(() => getRedirectTargetByRole(user?.role), [user?.role]);
  const rulesState = useMemo(() => {
    return passwordRules.map((rule) => ({
      ...rule,
      isValid: rule.test(newPassword),
    }));
  }, [newPassword]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate(redirectTarget, { replace: true });
    }, 160);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, redirectTarget, successMessage]);

  if (isDemoMode) {
    return <Navigate replace to="/login" />;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  if (!requiresPasswordChange) {
    return <Navigate replace to={redirectTarget} />;
  }

  const passwordErrors = {
    currentPassword: currentPassword ? null : "Informe a senha temporária atual.",
    newPassword: newPassword ? null : "Informe a nova senha.",
    confirmPassword: confirmPassword ? null : "Confirme a nova senha.",
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Preencha todos os campos para continuar.");
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccessMessage("Senha atualizada com sucesso. Redirecionando para sua área.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível concluir a troca de senha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Primeiro acesso"
        eyebrow="Senha obrigatória"
        title="Troque sua senha temporária"
        description="Antes de acessar a área do aluno, defina uma nova senha pessoal para continuar com segurança."
        meta={[
          { label: "Perfil", value: user?.role === "student" ? "Aluno" : "Usuário local" },
          { label: "Acesso", value: "Pendente até concluir a troca" },
        ]}
      />

      <AlertBox title="Troca obrigatória de senha" tone="warning">
        Seu acesso foi criado com uma senha temporária. Para proteger sua conta local, troque essa
        senha antes de seguir.
      </AlertBox>

      {errorMessage ? (
        <AlertBox title="Não foi possível atualizar a senha" tone="warning">
          {errorMessage}
        </AlertBox>
      ) : null}

      {successMessage ? (
        <AlertBox title="Senha atualizada" tone="success">
          {successMessage}
        </AlertBox>
      ) : null}

      <div className="two-column-grid">
        <Card tone="default">
          <p className="card-eyebrow">Atualize o acesso</p>
          <h2>Defina sua nova senha</h2>
          <form className="form-grid" noValidate onSubmit={handleSubmit}>
            <label className="field" htmlFor="current-password">
              <span className="field__label">Senha temporária atual</span>
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  className="field__control"
                  id="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                />
                <Button
                  aria-label={showCurrentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
                  className="password-field__toggle"
                  onClick={() => setShowCurrentPassword((current) => !current)}
                  size="compact"
                  type="button"
                  variant="ghost"
                >
                  {showCurrentPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {!currentPassword ? (
                <span className="field__message field__message--error">
                  {passwordErrors.currentPassword}
                </span>
              ) : null}
            </label>

            <label className="field" htmlFor="new-password">
              <span className="field__label">Nova senha</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  className="field__control"
                  id="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                />
                <Button
                  aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                  className="password-field__toggle"
                  onClick={() => setShowNewPassword((current) => !current)}
                  size="compact"
                  type="button"
                  variant="ghost"
                >
                  {showNewPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {!newPassword ? (
                <span className="field__message field__message--error">{passwordErrors.newPassword}</span>
              ) : null}
            </label>

            <label className="field" htmlFor="confirm-password">
              <span className="field__label">Confirme a nova senha</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  className="field__control"
                  id="confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                />
                <Button
                  aria-label={
                    showConfirmPassword ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"
                  }
                  className="password-field__toggle"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  size="compact"
                  type="button"
                  variant="ghost"
                >
                  {showConfirmPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {!confirmPassword ? (
                <span className="field__message field__message--error">
                  {passwordErrors.confirmPassword}
                </span>
              ) : null}
            </label>

            <div className="button-row">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Atualizando..." : "Atualizar senha"}
              </Button>
              <Button onClick={logout} type="button" variant="secondary">
                Sair
              </Button>
            </div>
          </form>
        </Card>

        <Card tone="soft">
          <p className="card-eyebrow">Regras da senha</p>
          <h2>O que a nova senha precisa ter</h2>
          <div aria-live="polite" className="stack-list password-rules">
            {rulesState.map((rule) => (
              <p
                className={`stack-list__item student-panel__note ${
                  rule.isValid ? "password-rules__item--valid" : ""
                }`}
                key={rule.id}
              >
                {rule.isValid ? "OK" : "Pendente"} • {rule.label}
              </p>
            ))}
          </div>
          <p className="student-panel__note">
            Sua nova senha não pode repetir a senha temporária atual.
          </p>
        </Card>
      </div>
    </div>
  );
};
