import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/useAuth";
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
import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import { ServiceRequestError, formatRetryAfterLabel } from "../services/api";
import { listAdminSelectableGroups } from "../services/adminGroupsService";
import {
  createAdminTeacher,
  getAdminUserPedagogicalGroups,
  sendAdminTeacherInvitation,
  updateAdminUserPedagogicalGroups,
} from "../services/adminTeachersService";
import {
  updateAdminUserStatus,
  type AdminUserStatusMutation,
} from "../services/adminUserStatusService";
import type { AdminSelectableGroup } from "../types/adminGroups";
import type {
  AdminUserActivationStatus,
  AdminUserListMeta,
  AdminUserListParams,
  AdminUsersListResult,
  AdminUsersListSource,
} from "../types/adminUsersList";
import {
  listAdminUsersList,
} from "../services/adminUsersListService";
import type {
  TeacherGroupOptionsState,
  TeacherListItem,
  TeacherOperationalState,
} from "../types/adminTeachers";

type AppliedQuery = {
  search?: string;
  operationalState: Exclude<TeacherOperationalState, "attention">;
  group?: string;
  page: number;
  pageSize: number;
};

type DraftFilters = {
  search: string;
  group: string;
};

type PageState =
  | { status: "loading" }
  | { status: "success"; items: TeacherListItem[]; meta: AdminUserListMeta; source: AdminUsersListSource }
  | { status: "empty"; meta: AdminUserListMeta; source: AdminUsersListSource }
  | { status: "error"; message: string };

type CreateDialogState = {
  fullName: string;
  email: string;
  groupIds: string[];
  errors: Partial<Record<"fullName" | "email" | "groupIds", string>>;
  message: string | null;
};

type EditDialogState = {
  teacher: TeacherListItem;
  groupIds: string[];
  originalGroupIds: string[];
  status: "loading" | "ready" | "error";
  message: string | null;
};

type SupervisionState = {
  status: "idle" | "loading" | "ready" | "error";
  groupIds: string[];
  savedGroupIds: string[];
  message: string | null;
};

type StatusConfirmation = {
  teacher: Pick<TeacherListItem, "id" | "name" | "emailMasked" | "status" | "activationStatus">;
  nextStatus: AdminUserStatusMutation;
};

type Feedback = {
  title: string;
  message: string;
};

const DEFAULT_QUERY: AppliedQuery = {
  operationalState: "all",
  page: 1,
  pageSize: 10,
};

const DEFAULT_DRAFT: DraftFilters = {
  search: "",
  group: "",
};

const operationalFilterOptions: Array<{
  value: Exclude<TeacherOperationalState, "attention">;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "awaiting_activation", label: "Aguardando ativação" },
  { value: "inactive", label: "Inativos" },
];

const operationalLabels: Record<TeacherOperationalState, string> = {
  all: "Todos",
  active: "Ativo",
  awaiting_activation: "Aguardando ativação",
  inactive: "Inativo",
  attention: "Requer atenção",
};

const operationalTone: Record<TeacherOperationalState, "published" | "pending" | "attention" | "draft"> = {
  all: "draft",
  active: "published",
  awaiting_activation: "pending",
  inactive: "attention",
  attention: "attention",
};

const invitationDeliveryLabels = {
  pending: "Convite em preparação",
  sent: "Convite enviado",
  failed: "Falha no envio",
  not_configured: "Envio não configurado",
} as const;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
};

const getTeacherOperationalState = (teacher: {
  status: TeacherListItem["status"];
  activationStatus: AdminUserActivationStatus;
}): Exclude<TeacherOperationalState, "all"> => {
  if (teacher.status === "inactive") {
    return "inactive";
  }

  if (teacher.status === "active" && teacher.activationStatus === "not_activated") {
    return "awaiting_activation";
  }

  if (teacher.status === "active" && teacher.activationStatus === "activated") {
    return "active";
  }

  return "attention";
};

const toListParams = (query: AppliedQuery): AdminUserListParams => {
  const base: AdminUserListParams = {
    role: "teacher",
    sortBy: "name",
    sortOrder: "asc",
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.group ? { group: query.group } : {}),
  };

  if (query.operationalState === "active") {
    return { ...base, status: "active", activationStatus: "activated" };
  }

  if (query.operationalState === "awaiting_activation") {
    return { ...base, status: "active", activationStatus: "not_activated" };
  }

  if (query.operationalState === "inactive") {
    return { ...base, status: "inactive" };
  }

  return base;
};

const hasAppliedFilters = (query: AppliedQuery) =>
  Boolean(query.search || query.group || query.operationalState !== "all");

const formatGroups = (groups: TeacherListItem["teacherGroups"]) =>
  groups.map((group) => group.name).join(", ") || "Sem grupo vinculado";

const normalizeIds = (groupIds: string[]) => [...new Set(groupIds)].sort();

const sameIds = (left: string[], right: string[]) => {
  const normalizedLeft = normalizeIds(left);
  const normalizedRight = normalizeIds(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
};

const getPageErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.kind === "network") {
      return "Não foi possível conectar ao serviço do portal agora.";
    }

    if (error.code === "AUTH_REQUIRED") {
      return "Sua sessão expirou. Faça login novamente para continuar.";
    }

    if (error.code === "FORBIDDEN") {
      return "Seu perfil não pode consultar professores.";
    }

    if (error.retryAfterSeconds) {
      return `Muitas consultas foram solicitadas. Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }
  }

  return "Não foi possível carregar professores agora.";
};

const getMutationErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.kind === "network") {
      return "Não foi possível conectar ao serviço do portal agora. Tente novamente.";
    }

    if (error.retryAfterSeconds) {
      return `Muitas tentativas foram feitas. Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }

    switch (error.code) {
      case "AUTH_REQUIRED":
        return "Sua sessão expirou. Faça login novamente.";
      case "FORBIDDEN":
      case "ADMIN_USER_TEACHER_GROUPS_ACTOR_NOT_AUTHORIZED":
        return "Seu perfil não pode executar esta ação administrativa.";
      case "PASSWORD_CHANGE_REQUIRED":
        return "Troque sua senha temporária antes de continuar.";
      case "INVALID_ADMIN_TEACHER_INPUT":
        return "Revise nome, e-mail e grupos antes de cadastrar o professor.";
      case "ADMIN_TEACHER_EMAIL_CONFLICT":
        return "Já existe usuário cadastrado com este e-mail.";
      case "ADMIN_PEDAGOGICAL_GROUP_NOT_FOUND":
      case "ADMIN_USER_TEACHER_GROUP_NOT_FOUND":
        return "Um dos grupos não está mais disponível. Atualize a lista e tente novamente.";
      case "ADMIN_PEDAGOGICAL_GROUP_INACTIVE":
      case "ADMIN_USER_TEACHER_GROUP_INACTIVE":
        return "Um dos grupos está inativo e não pode ser atribuído.";
      case "ADMIN_PEDAGOGICAL_BOOK_ACCESS_UNAVAILABLE":
        return "O livro pedagógico de um dos grupos está indisponível.";
      case "ADMIN_USER_NOT_FOUND":
        return "Professor não encontrado. Atualize a listagem.";
      case "ADMIN_PEDAGOGICAL_GROUPS_TARGET_NOT_ALLOWED":
      case "ADMIN_USER_TEACHER_GROUPS_TARGET_NOT_TEACHER":
        return "Este perfil não pode receber esse escopo pedagógico.";
      case "ADMIN_USER_ACCOUNT_NOT_ACTIVATED":
      case "ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED":
        return "Esta transição de status não é permitida para a conta selecionada.";
      case "ADMIN_USER_SELF_DEACTIVATION_NOT_ALLOWED":
        return "Você não pode inativar a própria conta administrativa.";
      case "INVITATION_DELIVERY_FAILED":
        return "O convite não pôde ser entregue agora. Nenhum link foi exibido no portal.";
      case "ADMIN_TEACHERS_UNAVAILABLE_IN_DEMO":
      case "ADMIN_USER_STATUS_UNAVAILABLE_IN_DEMO":
        return "Esta ação está indisponível no modo demonstrativo.";
      default:
        return "Não foi possível concluir a ação agora. Atualize os dados e tente novamente.";
    }
  }

  return "Não foi possível concluir a ação agora. Atualize os dados e tente novamente.";
};

const buildInitialCreateState = (): CreateDialogState => ({
  fullName: "",
  email: "",
  groupIds: [],
  errors: {},
  message: null,
});

const validateCreateState = (state: CreateDialogState) => {
  const errors: CreateDialogState["errors"] = {};
  const fullName = state.fullName.trim();
  const email = state.email.trim().toLowerCase();
  const groupIds = normalizeIds(state.groupIds);

  if (!fullName) {
    errors.fullName = "Informe o nome completo.";
  }

  if (!email || !isEmailLike(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (groupIds.length === 0) {
    errors.groupIds = "Selecione pelo menos um grupo.";
  }

  return {
    input: { fullName, email, groupIds },
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

const toggleId = (ids: string[], id: string) => {
  return ids.includes(id) ? ids.filter((value) => value !== id) : normalizeIds([...ids, id]);
};

const TeacherGroupChecklist = ({
  disabled,
  error,
  groups,
  label,
  onChange,
  selectedGroupIds,
}: {
  disabled: boolean;
  error?: string | null;
  groups: AdminSelectableGroup[];
  label: string;
  onChange: (groupIds: string[]) => void;
  selectedGroupIds: string[];
}) => (
  <fieldset className="admin-user-group-checklist" disabled={disabled}>
    <legend>{label}</legend>
    {groups.length === 0 ? (
      <p className="card-subtitle">Nenhum grupo ativo disponível.</p>
    ) : null}
    {groups.map((group) => (
      <label className="admin-user-group-checklist__item" key={group.slug}>
        <input
          checked={selectedGroupIds.includes(group.slug)}
          onChange={() => onChange(toggleId(selectedGroupIds, group.slug))}
          type="checkbox"
        />
        <span>{group.name}</span>
      </label>
    ))}
    {error ? <p className="field__message field__message--error">{error}</p> : null}
  </fieldset>
);

export const AdminTeachersPage = () => {
  const { user } = useAuth();
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [appliedQuery, setAppliedQuery] = useState<AppliedQuery>(DEFAULT_QUERY);
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [groupsState, setGroupsState] = useState<TeacherGroupOptionsState>({
    status: "idle",
    items: [],
  });
  const [createDialog, setCreateDialog] = useState<CreateDialogState | null>(null);
  const [editDialog, setEditDialog] = useState<EditDialogState | null>(null);
  const [supervision, setSupervision] = useState<SupervisionState>({
    status: "idle",
    groupIds: [],
    savedGroupIds: [],
    message: null,
  });
  const [statusConfirmation, setStatusConfirmation] = useState<StatusConfirmation | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const groupsRequestIdRef = useRef(0);
  const supervisionRequestIdRef = useRef(0);
  const activeGroups = useMemo(
    () => groupsState.items.filter((group) => group.status === "active"),
    [groupsState.items],
  );
  const currentMeta = pageState.status === "success" || pageState.status === "empty" ? pageState.meta : null;
  const currentSource = pageState.status === "success" || pageState.status === "empty" ? pageState.source : null;
  const canMutate = currentSource === "api" && appConfig.appMode !== "demo" && !appConfig.isGithubPages;
  const canGoPrevious = Boolean(currentMeta && currentMeta.page > 1 && pageState.status !== "loading");
  const canGoNext = Boolean(
    currentMeta &&
      currentMeta.totalPages > 0 &&
      currentMeta.page < currentMeta.totalPages &&
      pageState.status !== "loading",
  );
  const isCreateSubmitting = pendingAction === "create-teacher";
  const isSupervisionSubmitting = pendingAction === "save-supervision";
  const isStatusSubmitting = pendingAction === "teacher-status";
  const supervisionHasGroups = supervision.savedGroupIds.length > 0;

  const loadTeachers = useCallback(
    async (
      query: AppliedQuery,
      options: { allowPageCorrection?: boolean; showLoading?: boolean } = {},
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (options.showLoading !== false) {
        setPageState({ status: "loading" });
      }

      try {
        const result = await listAdminUsersList(toListParams(query));
        const teachers = result.items.filter((item): item is TeacherListItem => item.role === "teacher");

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
          void loadTeachers(correctedQuery, { allowPageCorrection: false });
          return;
        }

        setPageState(
          teachers.length > 0
            ? { status: "success", items: teachers, meta: result.meta, source: result.source }
            : { status: "empty", meta: result.meta, source: result.source },
        );
      } catch (error) {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        setPageState({ status: "error", message: getPageErrorMessage(error) });
      }
    },
    [],
  );

  const loadGroups = useCallback(async () => {
    const requestId = groupsRequestIdRef.current + 1;
    groupsRequestIdRef.current = requestId;
    setGroupsState((current) => ({ ...current, status: "loading", message: undefined }));

    try {
      const result = await listAdminSelectableGroups("all");

      if (!mountedRef.current || requestId !== groupsRequestIdRef.current) {
        return;
      }

      setGroupsState({
        status: "success",
        items: result.items,
        source: result.source,
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== groupsRequestIdRef.current) {
        return;
      }

      setGroupsState({
        status: "error",
        items: [],
        message: getPageErrorMessage(error),
      });
    }
  }, []);

  const loadSupervision = useCallback(async () => {
    if (!user || user.role !== "admin") {
      return;
    }

    const requestId = supervisionRequestIdRef.current + 1;
    supervisionRequestIdRef.current = requestId;
    setSupervision((current) => ({ ...current, status: "loading", message: null }));

    try {
      const result = await getAdminUserPedagogicalGroups(user.id);
      const groupIds = normalizeIds(result.user.groups.map((group) => group.slug));

      if (!mountedRef.current || requestId !== supervisionRequestIdRef.current) {
        return;
      }

      setSupervision({
        status: "ready",
        groupIds,
        savedGroupIds: groupIds,
        message: null,
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== supervisionRequestIdRef.current) {
        return;
      }

      if (appConfig.appMode === "demo" || appConfig.isGithubPages) {
        setSupervision({
          status: "ready",
          groupIds: [],
          savedGroupIds: [],
          message: null,
        });
        return;
      }

      setSupervision({
        status: "error",
        groupIds: [],
        savedGroupIds: [],
        message: getMutationErrorMessage(error),
      });
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    void loadTeachers(DEFAULT_QUERY);
    void loadGroups();

    return () => {
      mountedRef.current = false;
    };
  }, [loadGroups, loadTeachers]);

  useEffect(() => {
    void loadSupervision();
  }, [loadSupervision]);

  const applyQuery = (query: AppliedQuery) => {
    setAppliedQuery(query);
    void loadTeachers(query);
  };

  const handleSubmitFilters = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const search = draftFilters.search.trim();
    const group = draftFilters.group.trim();

    applyQuery({
      ...appliedQuery,
      search: search || undefined,
      group: group || undefined,
      page: 1,
    });
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_DRAFT);

    if (!hasAppliedFilters(appliedQuery)) {
      return;
    }

    applyQuery(DEFAULT_QUERY);
  };

  const handleOperationalFilter = (
    operationalState: Exclude<TeacherOperationalState, "attention">,
  ) => {
    applyQuery({ ...appliedQuery, operationalState, page: 1 });
  };

  const handlePage = (page: number) => {
    applyQuery({ ...appliedQuery, page });
  };

  const handleCreateSubmit = async () => {
    if (!createDialog || isCreateSubmitting) {
      return;
    }

    const validation = validateCreateState(createDialog);

    if (!validation.isValid) {
      setCreateDialog({ ...createDialog, errors: validation.errors, message: null });
      return;
    }

    setPendingAction("create-teacher");
    setCreateDialog({ ...createDialog, errors: {}, message: null });
    setFeedback(null);

    try {
      await createAdminTeacher(validation.input);

      if (!mountedRef.current) {
        return;
      }

      setCreateDialog(null);
      setNotice("Professor criado com sucesso. A conta está aguardando ativação.");
      void loadTeachers(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setCreateDialog({
        ...createDialog,
        errors: {},
        message: getMutationErrorMessage(error),
      });
    } finally {
      if (mountedRef.current) {
        setPendingAction(null);
      }
    }
  };

  const openEditDialog = async (teacher: TeacherListItem) => {
    if (!canMutate || pendingAction) {
      return;
    }

    setFeedback(null);
    setNotice(null);
    setEditDialog({
      teacher,
      groupIds: normalizeIds(teacher.teacherGroups.map((group) => group.slug)),
      originalGroupIds: normalizeIds(teacher.teacherGroups.map((group) => group.slug)),
      status: "loading",
      message: null,
    });

    try {
      const result = await getAdminUserPedagogicalGroups(teacher.id);
      const groupIds = normalizeIds(result.user.groups.map((group) => group.slug));

      if (!mountedRef.current) {
        return;
      }

      setEditDialog({
        teacher,
        groupIds,
        originalGroupIds: groupIds,
        status: "ready",
        message: null,
      });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setEditDialog((current) =>
        current
          ? {
              ...current,
              status: "error",
              message: getMutationErrorMessage(error),
            }
          : current,
      );
    }
  };

  const handleEditSubmit = async () => {
    if (!editDialog || editDialog.status !== "ready" || pendingAction) {
      return;
    }

    if (editDialog.groupIds.length === 0) {
      setEditDialog({ ...editDialog, message: "Selecione pelo menos um grupo." });
      return;
    }

    setPendingAction(`edit-${editDialog.teacher.id}`);
    setEditDialog({ ...editDialog, message: null });

    try {
      await updateAdminUserPedagogicalGroups(editDialog.teacher.id, {
        groupIds: editDialog.groupIds,
      });

      if (!mountedRef.current) {
        return;
      }

      setEditDialog(null);
      setNotice("Grupos pedagógicos do professor atualizados com sucesso.");
      void loadTeachers(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setEditDialog((current) =>
        current ? { ...current, message: getMutationErrorMessage(error) } : current,
      );
    } finally {
      if (mountedRef.current) {
        setPendingAction(null);
      }
    }
  };

  const handleSendInvitation = async (teacher: TeacherListItem) => {
    if (!canMutate || pendingAction) {
      return;
    }

    setPendingAction(`invite-${teacher.id}`);
    setFeedback(null);
    setNotice(null);

    try {
      const result = await sendAdminTeacherInvitation(teacher.id);

      if (!mountedRef.current) {
        return;
      }

      setNotice(
        `${invitationDeliveryLabels[result.invitation.deliveryStatus]} para ${teacher.name}.`,
      );
      void loadTeachers(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setFeedback({
        title: "Não foi possível enviar o convite",
        message: getMutationErrorMessage(error),
      });
    } finally {
      if (mountedRef.current) {
        setPendingAction(null);
      }
    }
  };

  const openStatusConfirmation = (teacher: TeacherListItem, nextStatus: AdminUserStatusMutation) => {
    if (!canMutate || pendingAction) {
      return;
    }

    setStatusConfirmation({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        emailMasked: teacher.emailMasked,
        status: teacher.status,
        activationStatus: teacher.activationStatus,
      },
      nextStatus,
    });
  };

  const handleConfirmStatus = async () => {
    if (!statusConfirmation || pendingAction) {
      return;
    }

    setPendingAction("teacher-status");
    setFeedback(null);

    try {
      await updateAdminUserStatus(statusConfirmation.teacher.id, statusConfirmation.nextStatus);

      if (!mountedRef.current) {
        return;
      }

      setNotice(
        statusConfirmation.nextStatus === "inactive"
          ? "Professor inativado com sucesso."
          : "Professor ativado com sucesso.",
      );
      setStatusConfirmation(null);
      void loadTeachers(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setFeedback({
        title: "Não foi possível alterar o status",
        message: getMutationErrorMessage(error),
      });
    } finally {
      if (mountedRef.current) {
        setPendingAction(null);
      }
    }
  };

  const handleSaveSupervision = async () => {
    if (!user || user.role !== "admin" || pendingAction) {
      return;
    }

    setPendingAction("save-supervision");
    setFeedback(null);
    setSupervision((current) => ({ ...current, message: null }));

    try {
      const result = await updateAdminUserPedagogicalGroups(user.id, {
        groupIds: supervision.groupIds,
      });
      const groupIds = normalizeIds(result.user.groups.map((group) => group.slug));

      if (!mountedRef.current) {
        return;
      }

      setSupervision({
        status: "ready",
        groupIds,
        savedGroupIds: groupIds,
        message: null,
      });
      setNotice(
        groupIds.length === 0
          ? "Supervisão pedagógica removida."
          : "Sua supervisão pedagógica foi atualizada.",
      );
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSupervision((current) => ({
        ...current,
        status: current.status === "idle" ? "error" : current.status,
        message: getMutationErrorMessage(error),
      }));
    } finally {
      if (mountedRef.current) {
        setPendingAction(null);
      }
    }
  };

  const renderOperationalFilters = () => (
    <div aria-label="Filtro por estado operacional" className="admin-knowledge-tabs" role="group">
      {operationalFilterOptions.map((option) => {
        const selected = appliedQuery.operationalState === option.value;

        return (
          <Button
            aria-pressed={selected}
            key={option.value}
            onClick={() => handleOperationalFilter(option.value)}
            size="compact"
            variant={selected ? "primary" : "secondary"}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );

  const renderPagination = () => (
    <nav aria-label="Paginação de professores">
      <div className="button-row">
        <Button
          disabled={!canGoPrevious}
          onClick={() => handlePage((currentMeta?.page ?? appliedQuery.page) - 1)}
          variant="secondary"
        >
          Anterior
        </Button>
        <Button
          disabled={!canGoNext}
          onClick={() => handlePage((currentMeta?.page ?? appliedQuery.page) + 1)}
          variant="secondary"
        >
          Próxima
        </Button>
      </div>
    </nav>
  );

  const renderTeacherActions = (teacher: TeacherListItem) => {
    const operationalState = getTeacherOperationalState(teacher);
    const nextStatus = teacher.status === "inactive" ? "active" : teacher.status === "active" ? "inactive" : null;

    if (!canMutate) {
      return <p className="card-subtitle">Ações indisponíveis no modo demonstrativo.</p>;
    }

    return (
      <div className="button-row admin-user-card__actions">
        <Button
          aria-label={`Editar grupos de ${teacher.name}`}
          disabled={Boolean(pendingAction)}
          onClick={() => void openEditDialog(teacher)}
          size="compact"
          variant="secondary"
        >
          {pendingAction === `edit-${teacher.id}` ? "Salvando..." : "Editar grupos"}
        </Button>
        <Button
          aria-label={`Enviar convite para ${teacher.name}`}
          disabled={Boolean(pendingAction) || operationalState === "active"}
          onClick={() => void handleSendInvitation(teacher)}
          size="compact"
          variant="secondary"
        >
          {pendingAction === `invite-${teacher.id}` ? "Enviando..." : "Enviar convite"}
        </Button>
        <Button
          aria-describedby={`teacher-resend-blocked-${teacher.id}`}
          disabled
          size="compact"
          variant="secondary"
        >
          Reenviar convite
        </Button>
        <span className="sr-only" id={`teacher-resend-blocked-${teacher.id}`}>
          Reenvio indisponível sem invitationId correlacionado pelo backend.
        </span>
        {nextStatus ? (
          <Button
            aria-label={`${nextStatus === "inactive" ? "Inativar" : "Ativar"} professor ${teacher.name}`}
            disabled={Boolean(pendingAction)}
            onClick={() => openStatusConfirmation(teacher, nextStatus)}
            size="compact"
            variant={nextStatus === "inactive" ? "destructive" : "primary"}
          >
            {nextStatus === "inactive" ? "Inativar" : "Ativar"}
          </Button>
        ) : null}
      </div>
    );
  };

  const renderTeacher = (teacher: TeacherListItem) => {
    const operationalState = getTeacherOperationalState(teacher);

    return (
      <Card as="article" className="admin-user-card" key={teacher.id}>
        <div className="admin-user-card__header">
          <div className="admin-user-card__identity">
            <p className="card-eyebrow">Professor</p>
            <h3>{teacher.name}</h3>
            <p>{teacher.emailMasked}</p>
            <div aria-label="Classificações do professor" className="admin-pill-row">
              <Badge tone="brand">Professor</Badge>
              <Badge tone={operationalState === "attention" ? "warning" : "sand"}>
                {operationalLabels[operationalState]}
              </Badge>
            </div>
          </div>
          <StatusTag
            label={operationalLabels[operationalState]}
            tone={operationalTone[operationalState]}
          />
        </div>

        <dl className="admin-user-card__meta">
          <div>
            <dt>Estado</dt>
            <dd>{operationalLabels[operationalState]}</dd>
          </div>
          <div>
            <dt>Ativação</dt>
            <dd>{teacher.activationStatus === "activated" ? "Ativada" : "Não ativada"}</dd>
          </div>
          <div>
            <dt>Grupos pedagógicos</dt>
            <dd>{formatGroups(teacher.teacherGroups)}</dd>
          </div>
          <div>
            <dt>Criado em</dt>
            <dd>{formatDate(teacher.createdAt)}</dd>
          </div>
        </dl>

        {renderTeacherActions(teacher)}
      </Card>
    );
  };

  const filterGroupOptions = [
    { label: "Todos os grupos", value: "" },
    ...groupsState.items.map((group) => ({
      label: group.status === "inactive" ? `${group.name} (inativo)` : group.name,
      value: group.slug,
    })),
  ];

  return (
    <div className="page-stack">
      <ProfileHeader
        actions={
          <div className="button-row">
            <Button
              disabled={!canMutate}
              onClick={() => setCreateDialog(buildInitialCreateState())}
            >
              Novo professor
            </Button>
          </div>
        }
        badge="Área administrativa"
        description="Gerencie professores, grupos pedagógicos e supervisão sem alterar papéis nem criar acesso implícito."
        eyebrow="Gestão de professores"
        title="Professores"
      />

      <section aria-labelledby="admin-teachers-title" className="page-section admin-overview" id="admin-professores">
        <div className="section-header">
          <Badge tone="sand">Acesso governado</Badge>
          <h2 id="admin-teachers-title">Professores</h2>
          <p>
            A listagem usa os vínculos pedagógicos retornados pelo backend e mantém BookAccess como autoridade.
          </p>
        </div>

        {currentSource === "demo" ? (
          <AlertBox title="Modo demonstrativo" tone="info">
            {DEMO_MODE_NOTICE}
          </AlertBox>
        ) : null}

        {notice ? (
          <AlertBox title="Ação concluída" tone="success">
            {notice}
          </AlertBox>
        ) : null}

        {feedback ? (
          <AlertBox title={feedback.title} tone="warning">
            {feedback.message}
          </AlertBox>
        ) : null}

        <Card tone="soft">
          <form onSubmit={handleSubmitFilters}>
            <div className="teacher-form-grid admin-user-filters">
              <TextInput
                id="admin-teachers-search"
                label="Buscar professor"
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Nome ou e-mail"
                value={draftFilters.search}
              />
              <Select
                id="admin-teachers-group-filter"
                label="Grupo"
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, group: event.target.value }))
                }
                options={filterGroupOptions}
                value={draftFilters.group}
              />
            </div>

            <div className="admin-user-filter-actions">
              <Button onClick={handleClearFilters} size="compact" type="button" variant="secondary">
                Limpar filtros
              </Button>
              <Button size="compact" type="submit">
                Aplicar filtros
              </Button>
            </div>
          </form>
        </Card>

        {renderOperationalFilters()}

        {groupsState.status === "error" ? (
          <AlertBox title="Não foi possível carregar grupos" tone="warning">
            <p>{groupsState.message}</p>
            <div className="button-row">
              <Button onClick={() => void loadGroups()} variant="secondary">
                Tentar novamente
              </Button>
            </div>
          </AlertBox>
        ) : null}

        {currentMeta ? (
          <p className="card-subtitle">
            {currentMeta.total === 0
              ? "0 professores"
              : `Página ${currentMeta.page} de ${currentMeta.totalPages} · ${currentMeta.total} professores`}
          </p>
        ) : null}

        {pageState.status === "loading" ? (
          <div role="status">
            <LoadingState
              description="Consultando professores, filtros e vínculos pedagógicos."
              title="Carregando professores"
            />
          </div>
        ) : null}

        {pageState.status === "error" ? (
          <Card tone="soft">
            <AlertBox title="Não foi possível carregar a lista" tone="warning">
              {pageState.message}
            </AlertBox>
            <div className="button-row">
              <Button onClick={() => void loadTeachers(appliedQuery)}>Tentar novamente</Button>
            </div>
          </Card>
        ) : null}

        {pageState.status === "empty" ? (
          <EmptyState
            action={
              hasAppliedFilters(appliedQuery) ? (
                <Button onClick={handleClearFilters} variant="secondary">
                  Limpar filtros
                </Button>
              ) : undefined
            }
            description={
              appliedQuery.search
                ? "Nenhum professor corresponde à busca informada."
                : hasAppliedFilters(appliedQuery)
                  ? "Nenhum professor encontrado com os filtros atuais."
                  : "Nenhum professor cadastrado."
            }
            title={hasAppliedFilters(appliedQuery) ? "Nenhum professor encontrado" : "Nenhum professor cadastrado"}
          />
        ) : null}

        {pageState.status === "success" ? (
          <div className="page-stack">{pageState.items.map(renderTeacher)}</div>
        ) : null}

        {renderPagination()}
      </section>

      <section
        aria-labelledby="admin-teacher-supervision-title"
        className="page-section admin-overview"
        id="admin-minha-supervisao"
      >
        <div className="section-header">
          <Badge tone="info">ADMIN</Badge>
          <h2 id="admin-teacher-supervision-title">Minha supervisão pedagógica</h2>
          <p>
            Esses grupos definem quais áreas pedagógicas você pode supervisionar. Seu perfil administrativo não será alterado.
          </p>
        </div>

        <Card tone="soft">
          {supervision.status === "loading" ? (
            <LoadingState
              description="Consultando seus vínculos pedagógicos explícitos."
              title="Carregando supervisão"
            />
          ) : null}

          {supervision.status === "error" ? (
            <AlertBox title="Supervisão indisponível" tone="warning">
              <p>{supervision.message}</p>
              <div className="button-row">
                <Button onClick={() => void loadSupervision()} variant="secondary">
                  Tentar novamente
                </Button>
              </div>
            </AlertBox>
          ) : null}

          {supervision.status === "idle" || supervision.status === "ready" ? (
            <>
              <TeacherGroupChecklist
                disabled={!canMutate || isSupervisionSubmitting || groupsState.status !== "success"}
                error={supervision.message}
                groups={activeGroups}
                label="Grupos da minha supervisão"
                onChange={(groupIds) =>
                  setSupervision((current) => ({ ...current, groupIds, message: null }))
                }
                selectedGroupIds={supervision.groupIds}
              />
              <div className="button-row">
                <Button
                  disabled={
                    !canMutate ||
                    isSupervisionSubmitting ||
                    groupsState.status !== "success" ||
                    sameIds(supervision.groupIds, supervision.savedGroupIds)
                  }
                  onClick={() => void handleSaveSupervision()}
                >
                  {isSupervisionSubmitting ? "Salvando..." : "Salvar acessos"}
                </Button>
                <Button
                  aria-disabled={!supervisionHasGroups}
                  to={supervisionHasGroups ? "/professor" : "/admin/professores"}
                  variant="secondary"
                >
                  Acessar área do professor
                </Button>
              </div>
              {!supervisionHasGroups ? (
                <p className="card-subtitle">
                  Selecione ao menos um grupo para acessar a supervisão pedagógica.
                </p>
              ) : null}
            </>
          ) : null}
        </Card>
      </section>

      {createDialog ? (
        <div
          aria-labelledby="create-teacher-dialog-title"
          aria-modal="true"
          className="admin-modal-backdrop"
          role="dialog"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Novo professor</p>
            <h2 id="create-teacher-dialog-title">Cadastrar professor</h2>
            <div className="teacher-form-grid">
              <TextInput
                disabled={isCreateSubmitting}
                error={createDialog.errors.fullName}
                id="create-teacher-full-name"
                label="Nome completo"
                onChange={(event) =>
                  setCreateDialog((current) =>
                    current ? { ...current, fullName: event.target.value } : current,
                  )
                }
                value={createDialog.fullName}
              />
              <TextInput
                disabled={isCreateSubmitting}
                error={createDialog.errors.email}
                id="create-teacher-email"
                label="E-mail"
                onChange={(event) =>
                  setCreateDialog((current) =>
                    current ? { ...current, email: event.target.value } : current,
                  )
                }
                type="email"
                value={createDialog.email}
              />
            </div>
            <TeacherGroupChecklist
              disabled={isCreateSubmitting || groupsState.status !== "success"}
              error={createDialog.errors.groupIds}
              groups={activeGroups}
              label="Grupos"
              onChange={(groupIds) =>
                setCreateDialog((current) =>
                  current ? { ...current, groupIds, errors: { ...current.errors, groupIds: undefined } } : current,
                )
              }
              selectedGroupIds={createDialog.groupIds}
            />
            {createDialog.message ? (
              <AlertBox title="Não foi possível cadastrar" tone="warning">
                {createDialog.message}
              </AlertBox>
            ) : null}
            <div className="button-row">
              <Button disabled={isCreateSubmitting} onClick={() => void handleCreateSubmit()}>
                {isCreateSubmitting ? "Cadastrando..." : "Cadastrar professor"}
              </Button>
              <Button
                disabled={isCreateSubmitting}
                onClick={() => setCreateDialog(null)}
                variant="secondary"
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {editDialog ? (
        <div
          aria-labelledby="edit-teacher-groups-dialog-title"
          aria-modal="true"
          className="admin-modal-backdrop"
          role="dialog"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Escopo pedagógico</p>
            <h2 id="edit-teacher-groups-dialog-title">Editar grupos</h2>
            <p>
              <strong>Professor:</strong> {editDialog.teacher.name} ({editDialog.teacher.emailMasked})
            </p>
            {editDialog.status === "loading" ? (
              <LoadingState
                description="Consultando o escopo pedagógico atual."
                title="Carregando grupos"
              />
            ) : null}
            {editDialog.status === "error" ? (
              <AlertBox title="Não foi possível consultar os grupos" tone="warning">
                {editDialog.message}
              </AlertBox>
            ) : null}
            {editDialog.status === "ready" ? (
              <TeacherGroupChecklist
                disabled={Boolean(pendingAction)}
                error={editDialog.message}
                groups={activeGroups}
                label="Grupos pedagógicos"
                onChange={(groupIds) =>
                  setEditDialog((current) =>
                    current ? { ...current, groupIds, message: null } : current,
                  )
                }
                selectedGroupIds={editDialog.groupIds}
              />
            ) : null}
            <div className="button-row">
              <Button
                disabled={
                  Boolean(pendingAction) ||
                  editDialog.status !== "ready" ||
                  editDialog.groupIds.length === 0 ||
                  sameIds(editDialog.groupIds, editDialog.originalGroupIds)
                }
                onClick={() => void handleEditSubmit()}
              >
                {pendingAction === `edit-${editDialog.teacher.id}` ? "Salvando..." : "Salvar vínculos"}
              </Button>
              <Button
                disabled={Boolean(pendingAction)}
                onClick={() => setEditDialog(null)}
                variant="secondary"
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {statusConfirmation ? (
        <div
          aria-labelledby="teacher-status-dialog-title"
          aria-modal="true"
          className="admin-modal-backdrop"
          role="dialog"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Status do professor</p>
            <h2 id="teacher-status-dialog-title">
              {statusConfirmation.nextStatus === "inactive"
                ? `Inativar ${statusConfirmation.teacher.name}?`
                : `Ativar ${statusConfirmation.teacher.name}?`}
            </h2>
            <p>
              <strong>Professor:</strong> {statusConfirmation.teacher.name} ({statusConfirmation.teacher.emailMasked})
            </p>
            {statusConfirmation.nextStatus === "inactive" ? (
              <AlertBox title="Confirmação necessária" tone="warning">
                As sessões ativas serão revogadas e o professor precisará autenticar-se novamente se for reativado.
              </AlertBox>
            ) : (
              <AlertBox title="Validação do backend" tone="info">
                A API confirmará se esta conta pode voltar ao estado ativo.
              </AlertBox>
            )}
            <div className="button-row">
              <Button
                disabled={isStatusSubmitting}
                onClick={() => void handleConfirmStatus()}
                variant={statusConfirmation.nextStatus === "inactive" ? "destructive" : "primary"}
              >
                {isStatusSubmitting
                  ? "Processando..."
                  : statusConfirmation.nextStatus === "inactive"
                    ? "Confirmar inativação"
                    : "Confirmar ativação"}
              </Button>
              <Button
                disabled={isStatusSubmitting}
                onClick={() => setStatusConfirmation(null)}
                variant="secondary"
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
