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

const getEmptyCopy = (
  data: UserStudyMeetingsResult | null,
  audience: "student" | "teacher",
) => {
  const groups = data?.groups ?? [];

  if (!data?.group && groups.length === 0) {
    return {
      title: audience === "teacher" ? "Nenhum grupo vinculado ao seu perfil" : "Nenhum grupo vinculado",
      description:
        audience === "teacher"
          ? "A agenda real aparece quando seu perfil de professor está vinculado a pelo menos um grupo ativo."
          : "A agenda real aparece quando seu perfil está vinculado a um grupo ativo.",
    };
  }

  if (groups.length > 0 && groups.every((group) => group.status === "inactive")) {
    return {
      title: audience === "teacher" ? "Grupos inativos" : "Grupo inativo",
      description:
        audience === "teacher"
          ? "Os grupos vinculados estão inativos no momento. Por segurança, os encontros e links não são exibidos."
          : "O grupo vinculado está inativo no momento. Por segurança, os encontros e o link não são exibidos.",
    };
  }

  return {
    title: audience === "teacher" ? "Nenhum encontro futuro encontrado" : "Sem encontros próximos",
    description:
      audience === "teacher"
        ? "Não há encontros atuais ou futuros disponíveis para os grupos vinculados agora."
        : "Não há encontros atuais ou futuros disponíveis para o seu grupo agora.",
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
      "Confira a conexão com o serviço do portal e tente carregar os encontros novamente.",
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

  if (!data || !data.group || data.items.length === 0) {
    const copy = getEmptyCopy(data, audience);

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
        group={primaryMeeting.group ?? data.group}
        meeting={primaryMeeting}
        title={audience === "teacher" ? "Agenda real dos seus grupos" : "Próximo encontro do seu grupo"}
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
