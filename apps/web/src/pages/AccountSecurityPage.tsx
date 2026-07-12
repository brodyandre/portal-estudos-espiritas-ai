import { useEffect, useMemo, useState } from "react";
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
      userAgentSummary: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0",
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

export const AccountSecurityPage = () => {
  const navigate = useNavigate();
  const { clearNotice, isDemoMode, logoutAll, logoutOthers, notice, user } = useAuth();
  const [sessions, setSessions] = useState<AuthSessionView[]>([]);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

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

  const handleRevokeSession = async (sessionId: string) => {
    const confirmed = window.confirm("Encerrar esta sessão agora?");

    if (!confirmed) {
      return;
    }

    setIsRevoking(sessionId);
    clearNotice();
    setErrorMessage(null);

    try {
      if (isDemoMode) {
        setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
        return;
      }

      await revokeAuthSession(sessionId);
      const nextSessions = await loadAuthSessions();
      setSessions(nextSessions);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    } finally {
      setIsRevoking(null);
    }
  };

  const handleLogoutOthers = async () => {
    const confirmed = window.confirm("Encerrar todas as outras sessões ativas?");

    if (!confirmed) {
      return;
    }

    setIsRevokingOthers(true);
    clearNotice();
    setErrorMessage(null);

    try {
      if (isDemoMode) {
        setSessions((currentSessions) => currentSessions.filter((session) => session.isCurrent));
        return;
      }

      await logoutOthers();
      const nextSessions = await loadAuthSessions();
      setSessions(nextSessions);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível encerrar as outras sessões.");
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const handleLogoutAll = async () => {
    const confirmed = window.confirm("Encerrar absolutamente todas as sessões deste perfil?");

    if (!confirmed) {
      return;
    }

    setIsRevokingAll(true);
    clearNotice();
    setErrorMessage(null);

    try {
      await logoutAll();
      navigate("/login", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível encerrar todas as sessões.");
    } finally {
      setIsRevokingAll(false);
    }
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Minha conta"
        eyebrow="Segurança"
        title="Sessões ativas"
        description="Veja onde seu acesso está aberto, encerre outras sessões e mantenha sua conta local mais organizada."
        meta={
          currentSession
            ? [
                { label: "Sessão atual", value: currentSession.device.label },
                { label: "Último acesso", value: formatDateTime(currentSession.lastSeenAt) },
              ]
            : undefined
        }
        actions={
          <div className="button-row">
            <Button disabled={isRevokingOthers || isRevokingAll} onClick={() => void handleLogoutOthers()} variant="secondary">
              Encerrar outras sessões
            </Button>
            <Button disabled={isRevokingAll || isRevokingOthers} onClick={() => void handleLogoutAll()} variant="ghost">
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
          description="Estamos conferindo as sessões ativas deste perfil no ambiente local."
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão encontrada"
          description="Quando houver novos acessos locais, eles aparecerão aqui para revisão rápida."
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
                <span className={`session-card__status session-card__status--${session.status}`}>{session.status}</span>
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
                    onClick={() => void handleRevokeSession(session.id)}
                    type="button"
                    variant="secondary"
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
          <h2>Uso demonstrativo e uso local</h2>
          <p>
            No GitHub Pages, esta tela existe para demonstrar a experiência. No ambiente local autorizado,
            as ações passam a revogar sessões reais sem expor identificadores técnicos na interface.
          </p>
        </Card>
      )}
    </div>
  );
};
