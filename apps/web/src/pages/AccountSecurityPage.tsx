import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appConfig } from "../config/appMode";
import { useAuth } from "../auth/useAuth";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { loadAuthSessions, revokeAuthSession, type AuthSessionView } from "../services/authService";

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Ainda não registrado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const sessionStatusLabels: Record<AuthSessionView["status"], string> = {
  active: "Ativa",
  expired: "Expirada",
  revoked: "Encerrada",
};

const demoSessions = (currentUserEmail?: string | null): AuthSessionView[] => [
  {
    id: "demo-current",
    createdAt: "2026-07-12T08:30:00.000Z",
    expiresAt: "2026-07-12T16:30:00.000Z",
    lastSeenAt: "2026-07-12T12:15:00.000Z",
    revokedAt: null,
    isCurrent: true,
    status: "active",
    device: {
      label: "Chrome em Windows",
      userAgentSummary: "Navegador reconhecido em ambiente demonstrativo.",
    },
  },
  {
    id: "demo-other",
    createdAt: "2026-07-11T20:00:00.000Z",
    expiresAt: "2026-07-12T04:00:00.000Z",
    lastSeenAt: "2026-07-11T22:15:00.000Z",
    revokedAt: null,
    isCurrent: false,
    status: "active",
    device: {
      label: "Navegador móvel",
      userAgentSummary: currentUserEmail ? `Sessão demonstrativa de ${currentUserEmail}` : "Sessão demonstrativa",
    },
  },
];

type ConfirmationDialog =
  | {
      type: "revoke-session";
      session: AuthSessionView;
      trigger: HTMLButtonElement | null;
    }
  | {
      type: "logout-others" | "logout-all";
      trigger: HTMLButtonElement | null;
    };

const CANCEL_CONFIRMATION_BUTTON_ID = "account-security-confirmation-cancel";

export const AccountSecurityPage = () => {
  const navigate = useNavigate();
  const { clearNotice, isDemoMode, logoutAll, logoutOthers, notice, user } = useAuth();
  const [sessions, setSessions] = useState<AuthSessionView[]>([]);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialog | null>(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.isCurrent) ?? null,
    [sessions],
  );

  useEffect(() => {
    if (isDemoMode) {
      setSessions(demoSessions(user?.email));
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    loadAuthSessions()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setSessions(items);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar as sessões agora.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, user?.email]);

  const isAnyRevocationLoading = Boolean(isRevoking) || isRevokingOthers || isRevokingAll;

  const closeConfirmationDialog = () => {
    if (isAnyRevocationLoading) {
      return;
    }

    const trigger = confirmationDialog?.trigger ?? null;
    setConfirmationDialog(null);
    window.setTimeout(() => {
      trigger?.focus();
    }, 0);
  };

  useEffect(() => {
    if (!confirmationDialog) {
      return;
    }

    const cancelButton = document.getElementById(CANCEL_CONFIRMATION_BUTTON_ID);

    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isAnyRevocationLoading) {
        closeConfirmationDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmationDialog, isAnyRevocationLoading]);

  const requestRevokeSession = (session: AuthSessionView, trigger: HTMLButtonElement | null) => {
    setConfirmationDialog({ type: "revoke-session", session, trigger });
  };

  const requestLogoutOthers = (trigger: HTMLButtonElement | null) => {
    setConfirmationDialog({ type: "logout-others", trigger });
  };

  const requestLogoutAll = (trigger: HTMLButtonElement | null) => {
    setConfirmationDialog({ type: "logout-all", trigger });
  };

  const handleRevokeSession = async (sessionId: string) => {
    setIsRevoking(sessionId);
    clearNotice();
    setErrorMessage(null);

    try {
      if (isDemoMode) {
        setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
        setConfirmationDialog(null);
        return;
      }

      await revokeAuthSession(sessionId);
      const nextSessions = await loadAuthSessions();
      setSessions(nextSessions);
      setConfirmationDialog(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    } finally {
      setIsRevoking(null);
    }
  };

  const handleLogoutOthers = async () => {
    setIsRevokingOthers(true);
    clearNotice();
    setErrorMessage(null);

    try {
      if (isDemoMode) {
        setSessions((currentSessions) => currentSessions.filter((session) => session.isCurrent));
        setConfirmationDialog(null);
        return;
      }

      await logoutOthers();
      const nextSessions = await loadAuthSessions();
      setSessions(nextSessions);
      setConfirmationDialog(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível encerrar as outras sessões.");
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsRevokingAll(true);
    clearNotice();
    setErrorMessage(null);

    try {
      await logoutAll();
      setConfirmationDialog(null);
      navigate("/login", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível encerrar todas as sessões.");
    } finally {
      setIsRevokingAll(false);
    }
  };

  const handleConfirmSecurityAction = async () => {
    if (!confirmationDialog || isAnyRevocationLoading) {
      return;
    }

    if (confirmationDialog.type === "revoke-session") {
      await handleRevokeSession(confirmationDialog.session.id);
      return;
    }

    if (confirmationDialog.type === "logout-others") {
      await handleLogoutOthers();
      return;
    }

    await handleLogoutAll();
  };

  const getDialogContent = () => {
    if (!confirmationDialog) {
      return null;
    }

    if (confirmationDialog.type === "revoke-session") {
      return {
        title: "Encerrar esta sessão?",
        description: `O acesso em ${confirmationDialog.session.device.label} será encerrado. Esta sessão não poderá continuar usando a conta sem novo login.`,
        confirmLabel: isRevoking === confirmationDialog.session.id ? "Encerrando..." : "Encerrar sessão",
      };
    }

    if (confirmationDialog.type === "logout-others") {
      return {
        title: "Encerrar outras sessões?",
        description:
          "A sessão atual permanecerá ativa neste navegador. Os outros acessos abertos serão encerrados e precisarão de novo login.",
        confirmLabel: isRevokingOthers ? "Encerrando..." : "Encerrar outras sessões",
      };
    }

    return {
      title: "Encerrar todas as sessões?",
      description:
        "Todos os acessos serão encerrados, incluindo esta sessão. Você será enviado para o login e precisará autenticar-se novamente.",
      confirmLabel: isRevokingAll ? "Encerrando..." : "Encerrar todas",
    };
  };

  const dialogContent = getDialogContent();

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Minha conta"
        eyebrow="Segurança"
        title="Sessões ativas"
        description="Veja onde seu acesso está aberto, encerre outras sessões e mantenha sua conta organizada."
        meta={
          currentSession
            ? [
                { label: "Sessão atual", value: currentSession.device.label },
                { label: "Último acesso", value: formatDateTime(currentSession.lastSeenAt) },
              ]
            : undefined
        }
        actions={
          <div className="button-row account-security-actions">
            <Button
              disabled={isRevokingOthers || isRevokingAll}
              onClick={(event: MouseEvent<HTMLButtonElement>) => requestLogoutOthers(event.currentTarget)}
              variant="destructiveSecondary"
            >
              Encerrar outras sessões
            </Button>
            <Button
              disabled={isRevokingAll || isRevokingOthers}
              onClick={(event: MouseEvent<HTMLButtonElement>) => requestLogoutAll(event.currentTarget)}
              variant="destructive"
            >
              Encerrar todas
            </Button>
          </div>
        }
      />

      {isDemoMode ? (
        <AlertBox title="Modo demonstrativo" tone="info">
          <p>Esta lista é simulada. A revogação real de sessões funciona apenas no ambiente local com backend.</p>
        </AlertBox>
      ) : null}

      {notice ? (
        <AlertBox title="Atualização de segurança" tone="success">
          <p>{notice}</p>
        </AlertBox>
      ) : null}

      {errorMessage ? (
        <AlertBox title="Não foi possível concluir a ação" tone="warning">
          <p>{errorMessage}</p>
        </AlertBox>
      ) : null}

      {isLoading ? (
        <LoadingState
          title="Carregando sessões"
          description="Estamos conferindo as sessões ativas deste perfil."
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão encontrada"
          description="Quando houver novos acessos, eles aparecerão aqui para revisão rápida."
        />
      ) : (
        <div className="session-security-grid">
          {sessions.map((session) => (
            <Card
              className={`session-card ${session.isCurrent ? "session-card--current" : ""}`}
              key={session.id}
              tone={session.isCurrent ? "brand" : "default"}
            >
              <div className="session-card__header">
                <div>
                  <p className="session-card__eyebrow">{session.isCurrent ? "Sessão atual" : "Sessão ativa"}</p>
                  <h2>{session.device.label}</h2>
                </div>
                <span className={`session-card__status session-card__status--${session.status}`}>
                  {sessionStatusLabels[session.status]}
                </span>
              </div>

              <dl className="session-card__meta">
                <div>
                  <dt>Criada em</dt>
                  <dd>{formatDateTime(session.createdAt)}</dd>
                </div>
                <div>
                  <dt>Último acesso</dt>
                  <dd>{formatDateTime(session.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt>Expira em</dt>
                  <dd>{formatDateTime(session.expiresAt)}</dd>
                </div>
              </dl>

              {session.device.userAgentSummary ? (
                <p className="session-card__summary">{session.device.userAgentSummary}</p>
              ) : null}

              {!session.isCurrent ? (
                <div className="session-card__actions">
                  <Button
                    disabled={isRevoking === session.id || isRevokingOthers || isRevokingAll}
                    onClick={(event: MouseEvent<HTMLButtonElement>) => requestRevokeSession(session, event.currentTarget)}
                    size="compact"
                    type="button"
                    variant="destructive"
                  >
                    {isRevoking === session.id ? "Encerrando..." : "Encerrar sessão"}
                  </Button>
                </div>
              ) : (
                <p className="session-card__current-note">Esta sessão permanece ativa neste navegador até você sair.</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {!appConfig.isGithubPages && !isDemoMode ? null : (
        <Card tone="soft">
          <h2>Experiência demonstrativa</h2>
          <p>
            Nesta demonstração, a lista simula sessões para revisão da experiência. Em ambiente autorizado,
            as ações encerram acessos reais sem mostrar identificadores técnicos na interface.
          </p>
        </Card>
      )}

      {confirmationDialog && dialogContent ? (
        <div
          aria-labelledby="account-security-confirmation-title"
          aria-modal="true"
          className="admin-modal-backdrop"
          role="dialog"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Segurança da conta</p>
            <h2 id="account-security-confirmation-title">{dialogContent.title}</h2>
            <p>{dialogContent.description}</p>

            {errorMessage ? (
              <AlertBox title="Não foi possível concluir a ação" tone="warning">
                <p>{errorMessage}</p>
              </AlertBox>
            ) : null}

            <div className="button-row">
              <Button
                disabled={isAnyRevocationLoading}
                onClick={closeConfirmationDialog}
                id={CANCEL_CONFIRMATION_BUTTON_ID}
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button
                disabled={isAnyRevocationLoading}
                onClick={() => void handleConfirmSecurityAction()}
                variant="destructive"
              >
                {dialogContent.confirmLabel}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
