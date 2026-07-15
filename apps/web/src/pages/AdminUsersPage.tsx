import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  AdminUserGroupDialog,
  WITHOUT_GROUP_VALUE,
  type GroupOptionsState,
} from "../components/admin/AdminUserGroupDialog";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextInput } from "../components/ui/TextInput";
import { readStoredAuthSession } from "../auth/storage";
import { appConfig } from "../config/appMode";
import { ServiceRequestError, formatRetryAfterLabel } from "../services/api";
import { listAdminSelectableGroups } from "../services/adminGroupsService";
import { updateAdminUserGroup } from "../services/adminUserGroupService";
import { listAdminUsersList } from "../services/adminUsersListService";
import {
  updateAdminUserStatus,
  type AdminUserStatusMutation,
} from "../services/adminUserStatusService";
import type { AdminSelectableGroup } from "../types/adminGroups";
import type {
  AdminUserActivationStatus,
  AdminUserGroupSummary,
  AdminUserListItem,
  AdminUserListMeta,
  AdminUserListParams,
  AdminUserListRole,
  AdminUserListSortBy,
  AdminUserListSortOrder,
  AdminUsersListResult,
  AdminUsersListSource,
} from "../types/adminUsersList";

const DEFAULT_QUERY = {
  search: undefined,
  role: undefined,
  status: undefined,
  activationStatus: undefined,
  group: undefined,
  sortBy: "createdAt",
  sortOrder: "desc",
  pageSize: 10,
  page: 1,
} as const;

const DEFAULT_DRAFT = {
  draftSearch: "",
  draftRole: "",
  draftStatus: "",
  draftActivationStatus: "",
  draftGroup: "",
  draftSortBy: "createdAt",
  draftSortOrder: "desc",
} as const;

type AppliedQuery = {
  search?: string;
  role?: AdminUserListRole;
  status?: AdminUsersListResult["items"][number]["status"];
  activationStatus?: AdminUserActivationStatus;
  group?: string;
  sortBy: AdminUserListSortBy;
  sortOrder: AdminUserListSortOrder;
  pageSize: number;
  page: number;
};

type DraftFilters = {
  draftSearch: string;
  draftRole: "" | AdminUserListRole;
  draftStatus: "" | AdminUsersListResult["items"][number]["status"];
  draftActivationStatus: "" | AdminUserActivationStatus;
  draftGroup: string;
  draftSortBy: AdminUserListSortBy;
  draftSortOrder: AdminUserListSortOrder;
};

type PageState =
  | { status: "loading" }
  | { status: "success"; items: AdminUserListItem[]; meta: AdminUserListMeta; source: AdminUsersListSource }
  | { status: "empty"; meta: AdminUserListMeta; source: AdminUsersListSource }
  | { status: "error"; message: string };

type StatusConfirmation = {
  user: Pick<AdminUserListItem, "id" | "name" | "emailMasked" | "status">;
  nextStatus: AdminUserStatusMutation;
};

type GroupDialogState = {
  user: Pick<AdminUserListItem, "id" | "name" | "emailMasked" | "group" | "status">;
};

type ActionFeedback = {
  title: string;
  message: string;
};

const roleOptions = [
  { label: "Todos os papéis", value: "" },
  { label: "Público", value: "visitor" },
  { label: "Aluno", value: "student" },
  { label: "Professor", value: "teacher" },
  { label: "Admin", value: "admin" },
];

const statusOptions = [
  { label: "Todos os status", value: "" },
  { label: "Pendente", value: "pending" },
  { label: "Ativo", value: "active" },
  { label: "Inativo", value: "inactive" },
  { label: "Recusado", value: "rejected" },
];

const activationOptions = [
  { label: "Todas as ativações", value: "" },
  { label: "Ativado", value: "activated" },
  { label: "Não ativado", value: "not_activated" },
];

const sortByOptions = [
  { label: "Data de criação", value: "createdAt" },
  { label: "Nome", value: "name" },
  { label: "Papel", value: "role" },
  { label: "Status", value: "status" },
];

const sortOrderOptions = [
  { label: "Mais recentes primeiro", value: "desc" },
  { label: "Mais antigos primeiro", value: "asc" },
];

const roleLabels: Record<AdminUserListRole, string> = {
  visitor: "Público",
  student: "Aluno",
  teacher: "Professor",
  admin: "Admin",
};

const statusLabels: Record<AdminUsersListResult["items"][number]["status"], string> = {
  pending: "Pendente",
  active: "Ativo",
  inactive: "Inativo",
  rejected: "Recusado",
};

const activationLabels: Record<AdminUserActivationStatus, string> = {
  activated: "Ativado",
  not_activated: "Não ativado",
};

const activationBadgeTone: Record<AdminUserActivationStatus, "success" | "sand"> = {
  activated: "success",
  not_activated: "sand",
};

const statusToneByUserStatus: Record<
  AdminUsersListResult["items"][number]["status"],
  "draft" | "published" | "attention"
> = {
  pending: "draft",
  active: "published",
  inactive: "attention",
  rejected: "attention",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateFormatter.format(date);
};

const formatPaginationSummary = (meta: AdminUserListMeta) => {
  const totalLabel = meta.total === 1 ? "usuário" : "usuários";

  if (meta.total === 0) {
    return `0 ${totalLabel}`;
  }

  return `Página ${meta.page} de ${meta.totalPages} · ${meta.total} ${totalLabel}`;
};

const normalizeDraftFilters = (draft: DraftFilters): AppliedQuery => {
  const trimmedSearch = draft.draftSearch.trim();
  const trimmedGroup = draft.draftGroup.trim();

  return {
    search: trimmedSearch || undefined,
    role: draft.draftRole || undefined,
    status: draft.draftStatus || undefined,
    activationStatus: draft.draftActivationStatus || undefined,
    group: trimmedGroup || undefined,
    sortBy: draft.draftSortBy,
    sortOrder: draft.draftSortOrder,
    pageSize: DEFAULT_QUERY.pageSize,
    page: 1,
  };
};

const toListParams = (query: AppliedQuery): AdminUserListParams => ({
  ...(query.search ? { search: query.search } : {}),
  ...(query.role ? { role: query.role } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.activationStatus ? { activationStatus: query.activationStatus } : {}),
  ...(query.group ? { group: query.group } : {}),
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
  pageSize: query.pageSize,
  page: query.page,
});

const isDefaultDraft = (draft: DraftFilters) => {
  return (
    draft.draftSearch === DEFAULT_DRAFT.draftSearch &&
    draft.draftRole === DEFAULT_DRAFT.draftRole &&
    draft.draftStatus === DEFAULT_DRAFT.draftStatus &&
    draft.draftActivationStatus === DEFAULT_DRAFT.draftActivationStatus &&
    draft.draftGroup === DEFAULT_DRAFT.draftGroup &&
    draft.draftSortBy === DEFAULT_DRAFT.draftSortBy &&
    draft.draftSortOrder === DEFAULT_DRAFT.draftSortOrder
  );
};

const isDefaultAppliedQuery = (query: AppliedQuery) => {
  return (
    query.search === DEFAULT_QUERY.search &&
    query.role === DEFAULT_QUERY.role &&
    query.status === DEFAULT_QUERY.status &&
    query.activationStatus === DEFAULT_QUERY.activationStatus &&
    query.group === DEFAULT_QUERY.group &&
    query.sortBy === DEFAULT_QUERY.sortBy &&
    query.sortOrder === DEFAULT_QUERY.sortOrder &&
    query.pageSize === DEFAULT_QUERY.pageSize &&
    query.page === DEFAULT_QUERY.page
  );
};

const hasAppliedFilters = (query: AppliedQuery) => {
  return Boolean(query.search || query.role || query.status || query.activationStatus || query.group);
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.code === "AUTH_REQUIRED") {
      return "Sua sessão local expirou. Faça login novamente para continuar.";
    }

    if (error.code === "FORBIDDEN") {
      return "Seu perfil não pode consultar esta lista no ambiente local.";
    }

    if (error.retryAfterSeconds) {
      return `Não foi possível carregar os usuários agora. Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }

    if (error.kind === "network") {
      return "Não foi possível conectar ao backend local agora.";
    }
  }

  return "Não foi possível carregar os usuários agora.";
};

const getStatusActionErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.kind === "network") {
      return "Não foi possível conectar ao backend local agora. Verifique a API e tente novamente.";
    }

    if (error.retryAfterSeconds) {
      return `Muitas tentativas de alteração de status. Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }

    switch (error.code) {
      case "AUTH_REQUIRED":
        return "Sua sessão local expirou. Faça login novamente para alterar status.";
      case "FORBIDDEN":
      case "ADMIN_USER_STATUS_ACTOR_NOT_AUTHORIZED":
        return "Seu perfil não pode alterar o status administrativo deste usuário.";
      case "PASSWORD_CHANGE_REQUIRED":
        return "Troque sua senha temporária antes de alterar status administrativos.";
      case "INVALID_ADMIN_USER_STATUS_INPUT":
        return "A solicitação de alteração de status está inválida. Atualize a lista e tente novamente.";
      case "ADMIN_USER_NOT_FOUND":
        return "Usuário não encontrado. Atualize a lista para consultar o estado atual.";
      case "ADMIN_USER_STATUS_ALREADY_SET":
        return "O usuário já está com este status. Atualize a lista para consultar o estado atual.";
      case "ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED":
      case "ADMIN_USER_ACCOUNT_NOT_ACTIVATED":
        return "Esta transição de status não é permitida para a conta selecionada.";
      case "ADMIN_USER_STATUS_CONFLICT":
        return "O estado do usuário mudou durante a operação. Atualize a lista e tente novamente.";
      case "ADMIN_USER_SELF_DEACTIVATION_NOT_ALLOWED":
        return "Você não pode inativar a própria conta administrativa.";
      case "ADMIN_USER_STATUS_UNAVAILABLE_IN_DEMO":
        return "Alteração de status indisponível no modo demonstrativo.";
      default:
        return "Não foi possível alterar o status agora. Atualize a lista e tente novamente.";
    }
  }

  return "Não foi possível alterar o status agora. Atualize a lista e tente novamente.";
};

const getGroupListErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.code === "AUTH_REQUIRED") {
      return "Sua sessão expirou. Faça login novamente.";
    }

    if (error.code === "FORBIDDEN") {
      return "Seu perfil não pode consultar grupos de usuários.";
    }

    if (error.code === "PASSWORD_CHANGE_REQUIRED") {
      return "Troque sua senha temporária antes de continuar.";
    }

    if (error.kind === "network") {
      return "Não foi possível carregar os grupos agora. Verifique a API local e tente novamente.";
    }
  }

  return "Não foi possível carregar os grupos agora. Tente novamente.";
};

const getGroupActionErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.retryAfterSeconds) {
      return `Muitas alterações foram solicitadas. Aguarde cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)} e tente novamente.`;
    }

    if (error.kind === "network") {
      return "Não foi possível alterar o grupo do usuário. Tente novamente.";
    }

    switch (error.code) {
      case "AUTH_REQUIRED":
        return "Sua sessão expirou. Faça login novamente.";
      case "FORBIDDEN":
        return "Seu perfil não pode alterar grupos de usuários.";
      case "PASSWORD_CHANGE_REQUIRED":
        return "Troque sua senha temporária antes de continuar.";
      case "ADMIN_USER_GROUP_ACTOR_NOT_AUTHORIZED":
        return "Seu perfil não pode alterar o grupo deste usuário.";
      case "ADMIN_USER_NOT_FOUND":
        return "O usuário não foi encontrado. Atualize a listagem.";
      case "ADMIN_USER_GROUP_NOT_FOUND":
        return "O grupo não está mais disponível. Atualize a lista de grupos e tente novamente.";
      case "ADMIN_USER_GROUP_INACTIVE":
        return "Este grupo ficou inativo e não pode ser vinculado. Escolha outro grupo.";
      case "ADMIN_USER_GROUP_ALREADY_SET":
        return "O usuário já está vinculado a esse grupo. A listagem será atualizada.";
      case "ADMIN_USER_GROUP_ALREADY_EMPTY":
        return "O usuário já está sem grupo. A listagem será atualizada.";
      case "ADMIN_USER_GROUP_CONFLICT":
        return "O vínculo foi alterado por outra operação. Atualize os dados e tente novamente.";
      case "INVALID_ADMIN_USER_GROUP_INPUT":
        return "A seleção de grupo é inválida. Atualize os dados e tente novamente.";
      case "ADMIN_USER_GROUP_RATE_LIMITED":
        return "Muitas alterações foram solicitadas. Aguarde e tente novamente.";
      case "ADMIN_USER_GROUP_UNAVAILABLE_IN_DEMO":
        return "A alteração de grupo não está disponível no modo de demonstração.";
      default:
        return "Não foi possível alterar o grupo do usuário. Tente novamente.";
    }
  }

  return "Não foi possível alterar o grupo do usuário. Tente novamente.";
};

const getCurrentUserId = () => readStoredAuthSession()?.user.id ?? null;

const getNextStatusForUser = (user: AdminUserListItem): AdminUserStatusMutation | null => {
  if (user.status === "active") {
    return "inactive";
  }

  if (user.status === "inactive") {
    return "active";
  }

  return null;
};

const canChangeUserGroup = (user: AdminUserListItem) =>
  user.status === "active" || user.status === "inactive";

const hasSelectableGroup = (
  groups: AdminSelectableGroup[],
  slug: string | null | undefined,
) => {
  if (!slug) {
    return false;
  }

  return groups.some((group) => group.slug === slug);
};

const normalizeSelectedGroupValue = (
  selectedValue: string,
  currentGroup: AdminUserGroupSummary | null,
  groups: AdminSelectableGroup[],
) => {
  if (selectedValue === WITHOUT_GROUP_VALUE) {
    return selectedValue;
  }

  if (hasSelectableGroup(groups, selectedValue)) {
    return selectedValue;
  }

  if (currentGroup?.slug === selectedValue) {
    return WITHOUT_GROUP_VALUE;
  }

  return WITHOUT_GROUP_VALUE;
};

const getStatusActionLabel = (status: AdminUserStatusMutation) =>
  status === "inactive" ? "Inativar" : "Ativar";

export const AdminUsersPage = () => {
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [appliedQuery, setAppliedQuery] = useState<AppliedQuery>(DEFAULT_QUERY);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [confirmation, setConfirmation] = useState<StatusConfirmation | null>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState | null>(null);
  const [groupOptionsState, setGroupOptionsState] = useState<GroupOptionsState>({
    status: "idle",
    items: [],
  });
  const [selectedGroupValue, setSelectedGroupValue] = useState(WITHOUT_GROUP_VALUE);
  const [groupDialogError, setGroupDialogError] = useState<string | null>(null);
  const [groupFieldError, setGroupFieldError] = useState<string | null>(null);
  const [groupActionInFlightUserId, setGroupActionInFlightUserId] = useState<string | null>(null);
  const [groupActionNotice, setGroupActionNotice] = useState<string | null>(null);
  const [groupActionError, setGroupActionError] = useState<ActionFeedback | null>(null);
  const [actionInFlight, setActionInFlight] = useState<StatusConfirmation | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionFeedback | null>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const groupRequestIdRef = useRef(0);
  const actionInFlightRef = useRef(false);
  const groupOptionsStateRef = useRef<GroupOptionsState>({
    status: "idle",
    items: [],
  });
  const groupActionInFlightRef = useRef(false);
  const groupDialogTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadUsers = useCallback(
    async (
      query: AppliedQuery,
      options: { allowPageCorrection?: boolean; showLoading?: boolean } = {},
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (options.showLoading !== false) {
        setState({ status: "loading" });
      }

      try {
        const result = await listAdminUsersList(toListParams(query));

        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        if (
          options.allowPageCorrection !== false &&
          result.meta.totalPages > 0 &&
          result.meta.page > result.meta.totalPages
        ) {
          const correctedQuery = { ...query, page: result.meta.totalPages };
          setAppliedQuery(correctedQuery);
          void loadUsers(correctedQuery, { allowPageCorrection: false });
          return;
        }

        setState(
          result.items.length > 0
            ? { status: "success", items: result.items, meta: result.meta, source: result.source }
            : { status: "empty", meta: result.meta, source: result.source },
        );
      } catch (error) {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        setState({ status: "error", message: getErrorMessage(error) });
      }
    },
    [],
  );

  const syncGroupOptionsState = useCallback((nextState: GroupOptionsState) => {
    groupOptionsStateRef.current = nextState;
    setGroupOptionsState(nextState);
  }, []);

  const loadSelectableGroups = useCallback(
    async (options: { force?: boolean } = {}) => {
      const currentState = groupOptionsStateRef.current;
      const requestId = groupRequestIdRef.current + 1;
      groupRequestIdRef.current = requestId;

      if (!options.force) {
        if (currentState.status === "loading" || currentState.status === "success") {
          return;
        }
      }

      syncGroupOptionsState({
        status: "loading",
        items: currentState.items,
      });

      try {
        const result = await listAdminSelectableGroups("active");

        if (!mountedRef.current || requestId !== groupRequestIdRef.current) {
          return;
        }

        syncGroupOptionsState({
          status: "success",
          items: result.items,
          source: result.source,
        });
      } catch (error) {
        if (!mountedRef.current || requestId !== groupRequestIdRef.current) {
          return;
        }

        syncGroupOptionsState({
          status: "error",
          items: currentState.items,
          message: getGroupListErrorMessage(error),
        });
      }
    },
    [syncGroupOptionsState],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadUsers(DEFAULT_QUERY);

    return () => {
      mountedRef.current = false;
    };
  }, [loadUsers]);

  useEffect(() => {
    if (!groupDialog) {
      return;
    }

    if (groupOptionsState.status !== "success") {
      return;
    }

    setSelectedGroupValue((current) =>
      normalizeSelectedGroupValue(current, groupDialog.user.group, groupOptionsState.items),
    );
  }, [groupDialog, groupOptionsState]);

  useEffect(() => {
    if (!groupDialog) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || groupActionInFlightRef.current) {
        return;
      }

      event.preventDefault();
      setGroupDialog(null);
      setGroupDialogError(null);
      setGroupFieldError(null);

      window.requestAnimationFrame(() => {
        groupDialogTriggerRef.current?.focus();
      });
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [groupDialog]);

  const applyQuery = (query: AppliedQuery) => {
    setAppliedQuery(query);
    void loadUsers(query);
  };

  const handleApplyFilters = (event?: FormEvent<HTMLElement>) => {
    event?.preventDefault();
    applyQuery(normalizeDraftFilters(draftFilters));
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_DRAFT);

    if (isDefaultDraft(draftFilters) && isDefaultAppliedQuery(appliedQuery)) {
      return;
    }

    applyQuery(DEFAULT_QUERY);
  };

  const handleRetry = () => {
    void loadUsers(appliedQuery);
  };

  const handleGoToPage = (page: number) => {
    applyQuery({ ...appliedQuery, page });
  };

  const openStatusConfirmation = (
    user: AdminUserListItem,
    nextStatus: AdminUserStatusMutation,
  ) => {
    if (actionInFlightRef.current || appConfig.appMode === "demo" || appConfig.isGithubPages) {
      return;
    }

    if (user.status !== "inactive" && nextStatus === "active") {
      return;
    }

    if (user.status !== "active" && nextStatus === "inactive") {
      return;
    }

    if (nextStatus === "inactive" && getCurrentUserId() === user.id) {
      return;
    }

    setActionError(null);
    setActionNotice(null);
    setConfirmation({
      user: {
        id: user.id,
        name: user.name,
        emailMasked: user.emailMasked,
        status: user.status,
      },
      nextStatus,
    });
  };

  const closeStatusConfirmation = () => {
    if (actionInFlightRef.current) {
      return;
    }

    setConfirmation(null);
  };

  const closeGroupDialog = () => {
    if (groupActionInFlightRef.current) {
      return;
    }

    setGroupDialog(null);
    setGroupDialogError(null);
    setGroupFieldError(null);

    window.requestAnimationFrame(() => {
      groupDialogTriggerRef.current?.focus();
    });
  };

  const openGroupDialog = (
    user: AdminUserListItem,
    triggerButton: HTMLButtonElement,
  ) => {
    if (
      !canMutateStatus ||
      !canChangeUserGroup(user) ||
      actionInFlightRef.current ||
      groupActionInFlightRef.current ||
      confirmation
    ) {
      return;
    }

    groupDialogTriggerRef.current = triggerButton;
    setActionNotice(null);
    setActionError(null);
    setGroupActionNotice(null);
    setGroupActionError(null);
    setGroupDialogError(null);
    setGroupFieldError(null);
    setSelectedGroupValue(user.group?.slug ?? WITHOUT_GROUP_VALUE);
    setGroupDialog({
      user: {
        id: user.id,
        name: user.name,
        emailMasked: user.emailMasked,
        group: user.group,
        status: user.status,
      },
    });

    void loadSelectableGroups({
      force: groupOptionsStateRef.current.status === "error",
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!confirmation || actionInFlightRef.current) {
      return;
    }

    actionInFlightRef.current = true;
    setActionInFlight(confirmation);
    setActionError(null);
    setActionNotice(null);

    try {
      await updateAdminUserStatus(confirmation.user.id, confirmation.nextStatus);

      if (!mountedRef.current) {
        return;
      }

      setConfirmation(null);
      setActionNotice(
        confirmation.nextStatus === "inactive"
          ? "Usuário inativado com sucesso."
          : "Usuário ativado com sucesso.",
      );
      void loadUsers(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setActionError({
        title: "Não foi possível alterar o status",
        message: getStatusActionErrorMessage(error),
      });
    } finally {
      actionInFlightRef.current = false;

      if (mountedRef.current) {
        setActionInFlight(null);
      }
    }
  };

  const handleConfirmGroupChange = async () => {
    if (
      !groupDialog ||
      groupActionInFlightRef.current ||
      groupOptionsState.status !== "success"
    ) {
      return;
    }

    const nextGroupSlug =
      selectedGroupValue === WITHOUT_GROUP_VALUE ? null : selectedGroupValue;

    groupActionInFlightRef.current = true;
    setGroupActionInFlightUserId(groupDialog.user.id);
    setGroupDialogError(null);
    setGroupFieldError(null);
    setGroupActionNotice(null);
    setGroupActionError(null);

    try {
      await updateAdminUserGroup(groupDialog.user.id, {
        groupSlug: nextGroupSlug,
      });

      if (!mountedRef.current) {
        return;
      }

      setGroupDialog(null);
      setGroupActionNotice("Grupo do usuário atualizado com sucesso.");
      window.requestAnimationFrame(() => {
        groupDialogTriggerRef.current?.focus();
      });
      void loadUsers(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      const message = getGroupActionErrorMessage(error);
      const errorCode = error instanceof ServiceRequestError ? error.code : undefined;

      if (
        errorCode === "AUTH_REQUIRED" ||
        errorCode === "FORBIDDEN" ||
        errorCode === "PASSWORD_CHANGE_REQUIRED" ||
        errorCode === "ADMIN_USER_GROUP_ACTOR_NOT_AUTHORIZED"
      ) {
        setGroupDialog(null);
        setGroupActionError({
          title: "Não foi possível alterar o grupo",
          message,
        });
        window.requestAnimationFrame(() => {
          groupDialogTriggerRef.current?.focus();
        });
        return;
      }

      if (errorCode === "ADMIN_USER_NOT_FOUND") {
        setGroupDialog(null);
        setGroupActionError({
          title: "Usuário atualizado",
          message,
        });
        window.requestAnimationFrame(() => {
          groupDialogTriggerRef.current?.focus();
        });
        void loadUsers(appliedQuery, { showLoading: false });
        return;
      }

      if (
        errorCode === "ADMIN_USER_GROUP_ALREADY_SET" ||
        errorCode === "ADMIN_USER_GROUP_ALREADY_EMPTY"
      ) {
        setGroupDialog(null);
        setGroupActionError({
          title: "Informação atualizada",
          message,
        });
        window.requestAnimationFrame(() => {
          groupDialogTriggerRef.current?.focus();
        });
        void loadUsers(appliedQuery, { showLoading: false });
        return;
      }

      if (errorCode === "ADMIN_USER_GROUP_CONFLICT") {
        setGroupDialog(null);
        setGroupActionError({
          title: "Dados atualizados",
          message,
        });
        window.requestAnimationFrame(() => {
          groupDialogTriggerRef.current?.focus();
        });
        void loadSelectableGroups({ force: true });
        void loadUsers(appliedQuery, { showLoading: false });
        return;
      }

      if (
        errorCode === "ADMIN_USER_GROUP_NOT_FOUND" ||
        errorCode === "ADMIN_USER_GROUP_INACTIVE" ||
        errorCode === "INVALID_ADMIN_USER_GROUP_INPUT"
      ) {
        setGroupDialogError(message);
        setGroupFieldError(message);
        void loadSelectableGroups({ force: true });
        return;
      }

      setGroupDialogError(message);
    } finally {
      groupActionInFlightRef.current = false;

      if (mountedRef.current) {
        setGroupActionInFlightUserId(null);
      }
    }
  };

  const currentMeta = state.status === "success" || state.status === "empty" ? state.meta : null;
  const currentSource = state.status === "success" || state.status === "empty" ? state.source : null;
  const isLoading = state.status === "loading";
  const currentUserId = getCurrentUserId();
  const canMutateStatus = currentSource === "api" && appConfig.appMode !== "demo" && !appConfig.isGithubPages;
  const canMutateGroups = canMutateStatus;
  const canGoPrevious = Boolean(currentMeta && currentMeta.page > 1 && !isLoading);
  const canGoNext = Boolean(
    currentMeta &&
      currentMeta.totalPages > 0 &&
      currentMeta.page < currentMeta.totalPages &&
      !isLoading,
  );
  const currentGroupUnavailable = Boolean(
    groupDialog?.user.group && groupOptionsState.status === "success"
      ? !hasSelectableGroup(groupOptionsState.items, groupDialog.user.group.slug)
      : false,
  );
  const currentGroupValue = groupDialog?.user.group?.slug ?? WITHOUT_GROUP_VALUE;
  const isGroupSelectionUnchanged = selectedGroupValue === currentGroupValue;
  const isGroupDialogSubmitting = groupActionInFlightUserId === groupDialog?.user.id;
  const isGroupDialogSubmitDisabled =
    isGroupDialogSubmitting ||
    groupOptionsState.status !== "success" ||
    isGroupSelectionUnchanged;

  const renderPaginationSummary = (meta: AdminUserListMeta) => (
    <p className="card-subtitle">{formatPaginationSummary(meta)}</p>
  );

  const renderPaginationControls = () => (
    <nav aria-label="Paginação de usuários administrativos">
      <div className="button-row">
        <Button
          disabled={!canGoPrevious}
          onClick={() => handleGoToPage((currentMeta?.page ?? appliedQuery.page) - 1)}
          variant="secondary"
        >
          Anterior
        </Button>
        <Button
          disabled={!canGoNext}
          onClick={() => handleGoToPage((currentMeta?.page ?? appliedQuery.page) + 1)}
          variant="secondary"
        >
          Próxima
        </Button>
      </div>
    </nav>
  );

  const renderStatusAction = (user: AdminUserListItem) => {
    const nextStatus = getNextStatusForUser(user);

    if (!canMutateStatus) {
      return <p className="card-subtitle">Alteração indisponível no modo demonstrativo.</p>;
    }

    if (!nextStatus) {
      return <p className="card-subtitle">Sem ação de status disponível.</p>;
    }

    const isSelfDeactivation = nextStatus === "inactive" && currentUserId === user.id;
    const disabledReasonId = `admin-user-status-disabled-${user.id}`;
    const isSubmitting = actionInFlight?.user.id === user.id;
    const actionLabel = getStatusActionLabel(nextStatus);

    return (
      <div className="button-row admin-user-card__actions">
        <Button
          aria-describedby={isSelfDeactivation ? disabledReasonId : undefined}
          aria-label={`${actionLabel} usuário ${user.name}`}
          disabled={
            Boolean(actionInFlight) ||
            Boolean(groupDialog) ||
            Boolean(groupActionInFlightUserId) ||
            isSelfDeactivation
          }
          onClick={() => openStatusConfirmation(user, nextStatus)}
          size="compact"
          variant={nextStatus === "inactive" ? "secondary" : "primary"}
        >
          {isSubmitting ? `${actionLabel}...` : actionLabel}
        </Button>
        {isSelfDeactivation ? (
          <p className="card-subtitle" id={disabledReasonId}>
            Você não pode inativar a própria conta administrativa.
          </p>
        ) : null}
      </div>
    );
  };

  const renderGroupAction = (user: AdminUserListItem) => {
    if (!canMutateGroups) {
      return null;
    }

    if (!canChangeUserGroup(user)) {
      return null;
    }

    const isSubmitting = groupActionInFlightUserId === user.id;

    return (
      <Button
        aria-label={`Alterar grupo de ${user.name}`}
        disabled={Boolean(confirmation) || Boolean(actionInFlight) || Boolean(groupDialog)}
        onClick={(event) => openGroupDialog(user, event.currentTarget)}
        size="compact"
        variant="secondary"
      >
        {isSubmitting ? "Salvando..." : "Alterar grupo"}
      </Button>
    );
  };

  const renderUserActions = (user: AdminUserListItem) => {
    const statusAction = renderStatusAction(user);
    const groupAction = renderGroupAction(user);

    return (
      <div aria-label={`Ações para ${user.name}`}>
        {groupAction ? (
          <div className="button-row admin-user-card__actions">
            {statusAction}
            {groupAction}
          </div>
        ) : (
          statusAction
        )}
      </div>
    );
  };

  const renderUser = (user: AdminUserListItem) => (
    <Card as="article" className="admin-user-card" key={user.id}>
      <div className="admin-user-card__header">
        <div>
          <p className="card-eyebrow">Usuário administrativo</p>
          <h3>{user.name}</h3>
          <p>{user.emailMasked}</p>
        </div>
        <StatusTag label={statusLabels[user.status]} tone={statusToneByUserStatus[user.status]} />
      </div>

      <div className="admin-pill-row" aria-label="Classificações do usuário">
        <Badge tone="brand">{roleLabels[user.role]}</Badge>
        <Badge tone={activationBadgeTone[user.activationStatus]}>
          {activationLabels[user.activationStatus]}
        </Badge>
      </div>

      <dl className="admin-user-card__meta">
        <div>
          <dt>Papel</dt>
          <dd>{roleLabels[user.role]}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabels[user.status]}</dd>
        </div>
        <div>
          <dt>Ativação</dt>
          <dd>{activationLabels[user.activationStatus]}</dd>
        </div>
        <div>
          <dt>Grupo</dt>
          <dd>{user.group?.name ?? "Sem grupo vinculado"}</dd>
        </div>
        <div>
          <dt>Criado em</dt>
          <dd>{formatDate(user.createdAt)}</dd>
        </div>
      </dl>

      {renderUserActions(user)}
    </Card>
  );

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Área administrativa"
        description="Consulte a base administrativa de usuários com filtros, paginação e proteção de dados sensíveis."
        eyebrow="Gestão de usuários"
        title="Gestão de usuários"
      />

      <section aria-labelledby="admin-users-title" className="page-section admin-overview" id="admin-users">
        <div className="section-header">
          <Badge tone="sand">Listagem protegida</Badge>
          <h2 id="admin-users-title">Usuários administrativos</h2>
          <p>Consulta somente leitura de perfis cadastrados no ambiente local ou no modo demonstrativo.</p>
        </div>

        {currentSource === "demo" ? (
          <AlertBox title="Modo demonstrativo" tone="info">
            Esta visualização usa apenas dados fictícios e não realiza chamadas para a API local.
          </AlertBox>
        ) : null}

        {actionNotice ? (
          <AlertBox title="Ação concluída" tone="success">
            {actionNotice}
          </AlertBox>
        ) : null}

        {groupActionNotice ? (
          <AlertBox title="Grupo atualizado" tone="success">
            {groupActionNotice}
          </AlertBox>
        ) : null}

        {groupActionError ? (
          <AlertBox title={groupActionError.title} tone="warning">
            {groupActionError.message}
          </AlertBox>
        ) : null}

        <Card tone="soft">
          <form onSubmit={handleApplyFilters}>
            <div className="teacher-form-grid admin-user-filters">
              <TextInput
                id="admin-users-search"
                label="Buscar por nome ou e-mail"
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, draftSearch: event.target.value }))
                }
                placeholder="Ex.: Ana, professor, lu***"
                value={draftFilters.draftSearch}
              />
              <Select
                id="admin-users-role-filter"
                label="Papel"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    draftRole: event.target.value as DraftFilters["draftRole"],
                  }))
                }
                options={roleOptions}
                value={draftFilters.draftRole}
              />
              <Select
                id="admin-users-status-filter"
                label="Status"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    draftStatus: event.target.value as DraftFilters["draftStatus"],
                  }))
                }
                options={statusOptions}
                value={draftFilters.draftStatus}
              />
              <Select
                id="admin-users-activation-filter"
                label="Ativação"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    draftActivationStatus: event.target.value as DraftFilters["draftActivationStatus"],
                  }))
                }
                options={activationOptions}
                value={draftFilters.draftActivationStatus}
              />
              <TextInput
                id="admin-users-group-filter"
                label="Grupo (slug)"
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, draftGroup: event.target.value }))
                }
                placeholder="Ex.: emmanuel"
                value={draftFilters.draftGroup}
              />
              <Select
                id="admin-users-sort-by"
                label="Ordenar por"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    draftSortBy: event.target.value as DraftFilters["draftSortBy"],
                  }))
                }
                options={sortByOptions}
                value={draftFilters.draftSortBy}
              />
              <Select
                id="admin-users-sort-order"
                label="Direção"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    draftSortOrder: event.target.value as DraftFilters["draftSortOrder"],
                  }))
                }
                options={sortOrderOptions}
                value={draftFilters.draftSortOrder}
              />
            </div>

            <div className="button-row">
              <Button type="submit">Aplicar filtros</Button>
              <Button onClick={handleClearFilters} type="button" variant="secondary">
                Limpar filtros
              </Button>
            </div>
          </form>
        </Card>

        {currentMeta ? renderPaginationSummary(currentMeta) : null}

        {state.status === "loading" ? (
          <div role="status">
            <LoadingState
              description="Consultando usuários, filtros aplicados e dados mascarados."
              title="Carregando usuários"
            />
          </div>
        ) : null}

        {state.status === "error" ? (
          <Card tone="soft">
            <AlertBox title="Não foi possível carregar a lista" tone="warning">
              <p>{state.message}</p>
            </AlertBox>
            <div className="button-row">
              <Button onClick={handleRetry}>Tentar novamente</Button>
            </div>
          </Card>
        ) : null}

        {state.status === "empty" ? (
          <EmptyState
            action={
              hasAppliedFilters(appliedQuery) ? (
                <Button onClick={handleClearFilters} variant="secondary">
                  Limpar filtros
                </Button>
              ) : undefined
            }
            description={
              hasAppliedFilters(appliedQuery)
                ? "Nenhum perfil corresponde aos filtros aplicados no momento."
                : "Quando houver contas disponíveis, a listagem aparecerá aqui com paginação e dados mascarados."
            }
            title={hasAppliedFilters(appliedQuery) ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
          />
        ) : null}

        {state.status === "success" ? (
          <div className="page-stack">
            {state.items.map(renderUser)}
          </div>
        ) : null}

        {renderPaginationControls()}
      </section>

      {confirmation ? (
        <div
          aria-labelledby="admin-user-status-dialog-title"
          aria-modal="true"
          className="admin-modal-backdrop"
          role="dialog"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Status de usuário</p>
            <h2 id="admin-user-status-dialog-title">
              {confirmation.nextStatus === "inactive"
                ? `Inativar ${confirmation.user.name}?`
                : `Ativar ${confirmation.user.name}?`}
            </h2>
            <p>
              {confirmation.nextStatus === "inactive"
                ? "Esta ação inativará o acesso administrativo selecionado."
                : "Esta ação reativará o acesso administrativo selecionado."}
            </p>
            <p>
              <strong>Usuário:</strong> {confirmation.user.name} ({confirmation.user.emailMasked})
            </p>

            {confirmation.nextStatus === "inactive" ? (
              <AlertBox title="Efeito da inativação" tone="warning">
                As sessões atuais do usuário serão revogadas. Após eventual reativação, o usuário
                precisará autenticar-se novamente, e tokens antigos permanecerão inválidos.
              </AlertBox>
            ) : (
              <AlertBox title="Confirmação necessária" tone="info">
                A API administrativa validará se a reativação ainda é permitida para esta conta.
              </AlertBox>
            )}

            {actionError ? (
              <AlertBox title={actionError.title} tone="warning">
                {actionError.message}
              </AlertBox>
            ) : null}

            <div className="button-row">
              <Button
                disabled={Boolean(actionInFlight)}
                onClick={() => void handleConfirmStatusChange()}
              >
                {actionInFlight
                  ? confirmation.nextStatus === "inactive"
                    ? "Inativando..."
                    : "Ativando..."
                  : confirmation.nextStatus === "inactive"
                    ? "Confirmar inativação"
                    : "Confirmar ativação"}
              </Button>
              <Button
                disabled={Boolean(actionInFlight)}
                onClick={closeStatusConfirmation}
                variant="secondary"
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {groupDialog ? (
        <AdminUserGroupDialog
          currentGroup={groupDialog.user.group}
          currentGroupUnavailable={currentGroupUnavailable}
          description={`Selecione o grupo de estudo de ${groupDialog.user.name}. Escolha “Sem grupo” para remover somente o vínculo atual.`}
          dialogError={groupDialogError}
          fieldError={groupFieldError}
          groupsState={groupOptionsState}
          isSubmitting={isGroupDialogSubmitting}
          isSubmitDisabled={isGroupDialogSubmitDisabled}
          onCancel={closeGroupDialog}
          onConfirm={() => void handleConfirmGroupChange()}
          onRetryLoad={() => void loadSelectableGroups({ force: true })}
          onValueChange={(value) => {
            setSelectedGroupValue(value);
            setGroupDialogError(null);
            setGroupFieldError(null);
          }}
          selectedValue={selectedGroupValue}
          userEmailMasked={groupDialog.user.emailMasked}
          userName={groupDialog.user.name}
        />
      ) : null}
    </div>
  );
};
