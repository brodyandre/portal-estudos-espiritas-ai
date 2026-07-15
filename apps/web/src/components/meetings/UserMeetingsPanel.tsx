import { ServiceRequestError } from "../../services/userStudyMeetingsService";
import type { UserStudyMeetingsResult } from "../../types/userStudyMeetings";
import { AlertBox } from "../ui/AlertBox";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { LoadingState } from "../ui/LoadingState";
import { UserMeetingCard } from "./UserMeetingCard";
import { UserMeetingList } from "./UserMeetingList";

interface UserMeetingsPanelProps {
  data: UserStudyMeetingsResult | null;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  audience: "student" | "teacher";
}

const getEmptyCopy = (data: UserStudyMeetingsResult | null) => {
  if (!data?.group) {
    return {
      title: "Nenhum grupo vinculado",
      description:
        "A agenda real aparece quando seu perfil está vinculado a um grupo ativo.",
    };
  }

  if (data.group.status === "inactive") {
    return {
      title: "Grupo inativo",
      description:
        "O grupo vinculado está inativo no momento. Por segurança, os encontros e o link não são exibidos.",
    };
  }

  return {
    title: "Sem encontros próximos",
    description:
      "Não há encontros atuais ou futuros disponíveis para o seu grupo agora.",
  };
};

const getErrorCopy = (error: Error | null) => {
  if (error instanceof ServiceRequestError && error.code === "AUTH_REQUIRED") {
    return {
      title: "Sessão necessária",
      description: "Faça login novamente para carregar a agenda do seu grupo.",
    };
  }

  if (error instanceof ServiceRequestError && error.code === "FORBIDDEN") {
    return {
      title: "Acesso não autorizado",
      description:
        "Seu perfil autenticado não tem permissão para consultar os encontros deste recurso.",
    };
  }

  return {
    title: "Não foi possível carregar a agenda",
    description:
      "Confira a conexão com a API local e tente carregar os encontros novamente.",
  };
};

export const UserMeetingsPanel = ({
  audience,
  data,
  error,
  isLoading,
  onRetry,
}: UserMeetingsPanelProps) => {
  if (isLoading) {
    return (
      <LoadingState
        description="Estamos buscando a agenda real vinculada ao seu perfil autenticado."
        title="Carregando encontros do grupo"
      />
    );
  }

  if (error) {
    const copy = getErrorCopy(error);

    return (
      <AlertBox title={copy.title} tone="warning">
        <p>{copy.description}</p>
        <div className="user-meetings__actions">
          <Button onClick={() => void onRetry()} variant="secondary">
            Tentar novamente
          </Button>
        </div>
      </AlertBox>
    );
  }

  if (!data || !data.group || data.group.status !== "active" || data.items.length === 0) {
    const copy = getEmptyCopy(data);

    return (
      <EmptyState
        action={
          <Button onClick={() => void onRetry()} variant="secondary">
            Atualizar agenda
          </Button>
        }
        description={copy.description}
        title={copy.title}
      />
    );
  }

  const [primaryMeeting, ...nextMeetings] = data.items;

  return (
    <div className="user-meetings">
      {data.notice ? (
        <AlertBox title="Agenda demonstrativa" tone="info">
          {data.notice}
        </AlertBox>
      ) : null}

      <UserMeetingCard
        group={data.group}
        meeting={primaryMeeting}
        title={audience === "teacher" ? "Agenda real do seu grupo" : "Próximo encontro do seu grupo"}
      />

      {nextMeetings.length > 0 ? (
        <Card className="user-meetings-list-card" tone="soft">
          <div className="user-meetings-list-card__header">
            <h3>Próximos encontros</h3>
            <Button onClick={() => void onRetry()} size="compact" variant="ghost">
              Atualizar
            </Button>
          </div>
          <UserMeetingList meetings={nextMeetings} />
        </Card>
      ) : null}
    </div>
  );
};
