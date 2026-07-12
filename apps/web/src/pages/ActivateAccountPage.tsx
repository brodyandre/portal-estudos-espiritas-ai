import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { appConfig } from "../config/appMode";
import { acceptAccountInvitation } from "../services/authService";

const passwordRules = [
  { id: "length", label: "Pelo menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { id: "upper", label: "Ao menos uma letra maiúscula", test: (value: string) => /[A-Z]/u.test(value) },
  { id: "lower", label: "Ao menos uma letra minúscula", test: (value: string) => /[a-z]/u.test(value) },
  { id: "digit", label: "Ao menos um número", test: (value: string) => /\d/u.test(value) },
] as const;

export const ActivateAccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        isValid: rule.test(password),
      })),
    [password],
  );

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, successMessage]);

  if (isDemoMode) {
    return <Navigate replace to="/login" />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token) {
      setErrorMessage("Abra novamente o convite recebido por e-mail para continuar.");
      return;
    }

    if (!password || !confirmPassword) {
      setErrorMessage("Preencha a nova senha e a confirmação.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await acceptAccountInvitation(token, password, confirmPassword);
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível ativar a conta agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Primeiro acesso"
        eyebrow="Convite de acesso"
        title="Criar minha senha"
        description="Use o link temporário recebido por e-mail para definir sua senha e concluir a ativação da conta."
      />

      {!token ? (
        <AlertBox title="Link incompleto" tone="warning">
          O convite de acesso não foi encontrado. Solicite um novo envio para continuar.
        </AlertBox>
      ) : null}

      {errorMessage ? (
        <AlertBox title="Não foi possível ativar" tone="warning">
          {errorMessage}
        </AlertBox>
      ) : null}

      {successMessage ? (
        <AlertBox title="Conta ativada" tone="success">
          {successMessage}
        </AlertBox>
      ) : null}

      <div className="two-column-grid">
        <Card tone="default">
          <p className="card-eyebrow">Definir senha</p>
          <h2>Crie sua senha de acesso</h2>
          <form className="form-grid" noValidate onSubmit={handleSubmit}>
            <label className="field" htmlFor="activation-password">
              <span className="field__label">Nova senha</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  className="field__control"
                  id="activation-password"
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <Button
                  aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                  className="password-field__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  size="compact"
                  type="button"
                  variant="ghost"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </label>

            <label className="field" htmlFor="activation-confirm-password">
              <span className="field__label">Confirmar nova senha</span>
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  className="field__control"
                  id="activation-confirm-password"
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
                {isSubmitting ? "Salvando..." : "Ativar conta"}
              </Button>
              <Button to="/login" variant="secondary">
                Voltar ao login
              </Button>
            </div>
          </form>
        </Card>

        <Card tone="soft">
          <p className="card-eyebrow">Orientações</p>
          <h2>Como concluir seu primeiro acesso</h2>
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
            Este link é pessoal, temporário e deve ser usado apenas para criar sua senha inicial.
          </p>
        </Card>
      </div>
    </div>
  );
};
