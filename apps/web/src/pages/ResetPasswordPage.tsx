import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { appConfig } from "../config/appMode";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { resetPasswordByRecoveryToken } from "../services/authService";

const passwordRules = [
  { id: "length", label: "Pelo menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { id: "upper", label: "Ao menos uma letra maiúscula", test: (value: string) => /[A-Z]/u.test(value) },
  { id: "lower", label: "Ao menos uma letra minúscula", test: (value: string) => /[a-z]/u.test(value) },
  { id: "digit", label: "Ao menos um número", test: (value: string) => /\d/u.test(value) },
] as const;

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = searchParams.get("token") ?? "";
  const isDemoMode = appConfig.appMode !== "local";
  const rulesState = useMemo(
    () =>
      passwordRules.map((rule) => ({
        ...rule,
        isValid: rule.test(newPassword),
      })),
    [newPassword],
  );

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, successMessage]);

  if (isDemoMode) {
    return <Navigate replace to="/esqueci-minha-senha" />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token) {
      setErrorMessage("Abra novamente o link de recuperação para continuar.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Preencha a nova senha e a confirmação.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetPasswordByRecoveryToken(token, newPassword, confirmPassword);
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível redefinir a senha agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Redefinição"
        eyebrow="Acesso local"
        title="Criar nova senha"
        description="Use o link temporário de recuperação para definir uma nova senha e entrar novamente no portal."
      />

      {!token ? (
        <AlertBox title="Link incompleto" tone="warning">
          O token de recuperação não foi encontrado. Solicite um novo link para continuar.
        </AlertBox>
      ) : null}

      {errorMessage ? (
        <AlertBox title="Não foi possível redefinir" tone="warning">
          {errorMessage}
        </AlertBox>
      ) : null}

      {successMessage ? (
        <AlertBox title="Senha redefinida" tone="success">
          {successMessage}
        </AlertBox>
      ) : null}

      <div className="two-column-grid">
        <Card tone="default">
          <p className="card-eyebrow">Nova senha</p>
          <h2>Escolha uma senha forte</h2>
          <form className="form-grid" noValidate onSubmit={handleSubmit}>
            <label className="field" htmlFor="reset-new-password">
              <span className="field__label">Nova senha</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  className="field__control"
                  id="reset-new-password"
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
            </label>

            <label className="field" htmlFor="reset-confirm-password">
              <span className="field__label">Confirmar nova senha</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  className="field__control"
                  id="reset-confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                />
                <Button
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmação da nova senha"
                      : "Mostrar confirmação da nova senha"
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
            </label>

            <div className="button-row">
              <Button disabled={isSubmitting || !token} type="submit">
                {isSubmitting ? "Salvando..." : "Redefinir senha"}
              </Button>
              <Button to="/login" variant="secondary">
                Voltar ao login
              </Button>
            </div>
          </form>
        </Card>

        <Card tone="soft">
          <p className="card-eyebrow">Regras da senha</p>
          <h2>O que sua nova senha precisa ter</h2>
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
            A nova senha não pode repetir a credencial atual associada a este acesso.
          </p>
        </Card>
      </div>
    </div>
  );
};
