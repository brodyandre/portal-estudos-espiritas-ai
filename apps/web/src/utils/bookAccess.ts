import type { DemoGroup, GroupSlug } from "../mocks";
import type { ServiceRequestError } from "../services/api";
import type { UserBookAccessGroup } from "../types/bookAccess";

export type BookAccessAudience = "student" | "teacher";

export const isKnownGroupSlug = (value: string): value is GroupSlug => {
  return value === "emmanuel" || value === "a-caminho-da-luz";
};

export const buildAuthorizedStudyGroups = (
  accessGroups: UserBookAccessGroup[],
  studies: DemoGroup[],
): DemoGroup[] => {
  const studiesBySlug = new Map(studies.map((study) => [study.slug, study]));

  return accessGroups.flatMap((accessGroup) => {
    if (!isKnownGroupSlug(accessGroup.id)) {
      return [];
    }

    const groupSlug = accessGroup.id;
    const study = studiesBySlug.get(groupSlug);

    return [
      {
        slug: groupSlug,
        name: accessGroup.name,
        meetingDay: study?.meetingDay ?? null,
        meetingTime: study?.meetingTime ?? null,
        participantCount: study?.participantCount ?? null,
        meetUrl: study?.meetUrl ?? null,
        bookTitle: accessGroup.knowledgeBook.title,
        description: study?.description ?? null,
        nextLesson: study?.nextLesson ?? null,
      },
    ];
  });
};

export const getBookAccessUnavailableCopy = (
  error: ServiceRequestError | Error | null,
  audience: BookAccessAudience,
) => {
  const code = error && "code" in error ? error.code : undefined;

  if (code === "AUTH_REQUIRED") {
    return {
      title: "Sessão necessária",
      description: "Sua sessão não está mais válida. Entre novamente.",
    };
  }

  if (code === "FORBIDDEN") {
    return {
      title:
        audience === "teacher"
          ? "Este perfil não possui acesso à área de livros do professor."
          : "Este perfil não possui acesso à área de livros do aluno.",
      description: "O acesso aos grupos privados não está disponível para este perfil.",
    };
  }

  if (code === "BOOK_ACCESS_CATALOG_UNAVAILABLE") {
    return {
      title: "Acesso aos livros indisponível",
      description:
        "Não foi possível carregar os vínculos de estudo agora. Tente novamente em instantes.",
    };
  }

  return {
    title: "Painel indisponível",
    description: "Não foi possível carregar seus vínculos de estudo agora. Tente novamente em instantes.",
  };
};

export const getAgentErrorMessage = (error: unknown) => {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  if (code === "BOOK_ACCESS_FORBIDDEN" || code === "FORBIDDEN") {
    return "O grupo solicitado não está disponível para este perfil.";
  }

  if (code === "BOOK_ACCESS_CATALOG_UNAVAILABLE") {
    return "Não foi possível carregar os vínculos de estudo agora. Tente novamente em instantes.";
  }

  if (code === "KNOWLEDGE_CORPUS_UNAVAILABLE") {
    return "Os materiais de estudo estão temporariamente indisponíveis. Tente novamente em instantes.";
  }

  if (code === "AUTH_REQUIRED") {
    return "Sua sessão não está mais válida. Entre novamente.";
  }

  return "Não foi possível concluir a solicitação agora. Tente novamente em instantes.";
};
