import { useState } from "react";

import { appConfig } from "../config/appMode";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TextInput } from "../components/ui/TextInput";
import { requestPasswordRecovery } from "../services/authService";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDemoMode = appConfig.appMode !== "local";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage("Informe seu e-mail para continuar.");
      return;
    }

    if (isDemoMode) {
      setErrorMessage("Modo demonstrativo: a recuperação real de senha depende da API local.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await requestPasswordRecovery(email);
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar a recuperação agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Recuperação"
        eyebrow="Acesso local"
        title="Esqueci minha senha"
        description="Informe seu e-mail para receber instruções de recuperação no ambiente local."
        meta={[
          { label: "Modo atual", value: isDemoMode ? "Demonstração" : "Local" },
          { label: "Entrega", value: isDemoMode ? "Indisponível" : "Prévia local segura" },
        ]}
      />

      {isDemoMode ? (
        <AlertBox title="Modo demonstrativo" tone="info">
          A recuperação real de senha depende da API local. No GitHub Pages, esta página permanece
          apenas como referência visual segura.
        </AlertBox>
      ) : null}

      {errorMessage ? (
        <AlertBox title="Não foi possível continuar" tone="warning">
          {errorMessage}
        </AlertBox>
      ) : null}

      {successMessage ? (
        <AlertBox title="Solicitação registrada" tone="success">
          {successMessage}
        </AlertBox>
      ) : null}

      <Card tone="default">
        <p className="card-eyebrow">Solicitar recuperação</p>
        <h2>Receber instruções por e-mail</h2>
        <form className="form-grid" noValidate onSubmit={handleSubmit}>
          <TextInput
            autoComplete="email"
            id="forgot-password-email"
            label="E-mail"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
            type="email"
            value={email}
          />

          <div className="button-row">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enviando..." : "Enviar instruções"}
            </Button>
            <Button to="/login" variant="secondary">
              Voltar ao login
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
