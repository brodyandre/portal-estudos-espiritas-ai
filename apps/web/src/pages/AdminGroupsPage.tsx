import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AdminMeetingCancelDialog } from "../components/admin/AdminMeetingCancelDialog";
import {
  AdminMeetingDialog,
  type AdminMeetingDialogMode,
  type AdminMeetingDialogValues,
} from "../components/admin/AdminMeetingDialog";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { appConfig } from "../config/appMode";
import { ServiceRequestError, formatRetryAfterLabel } from "../services/api";
import { listAdminSelectableGroups } from "../services/adminGroupsService";
import {
  cancelAdminStudyMeeting,
  createAdminStudyMeeting,
  listAdminStudyMeetings,
  updateAdminStudyMeeting,
} from "../services/adminStudyMeetingsService";
import type { AdminSelectableGroup } from "../types/adminGroups";
import type {
  AdminStudyMeeting,
  AdminStudyMeetingDerivedStatus,
  AdminStudyMeetingListMeta,
  AdminStudyMeetingListParams,
  CancelAdminStudyMeetingInput,
  CreateAdminStudyMeetingInput,
  UpdateAdminStudyMeetingInput,
} from "../types/adminStudyMeetings";
import {
  canCancelAdminStudyMeeting,
  canEditAdminStudyMeeting,
  getAdminStudyMeetingDerivedStatus,
} from "../utils/adminStudyMeetings";

const DEFAULT_FILTERS = {
  includeCanceled: false,
  sortOrder: "asc",
  pageSize: 10,
  page: 1,
} as const;

type SortOrder = "asc" | "desc";

type AppliedFilters = {
  includeCanceled: boolean;
  sortOrder: SortOrder;
  pageSize: number;
  page: number;
};

type DraftFilters = {
  includeCanceled: boolean;
  sortOrder: SortOrder;
  pageSize: "10" | "25" | "50";
};

type GroupsState =
  | { status: "loading" }
  | { status: "success"; items: AdminSelectableGroup[]; source: "api" | "demo" }
  | { status: "empty"; source: "api" | "demo" }
  | { status: "error"; message: string };

type MeetingsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; items: AdminStudyMeeting[]; meta: AdminStudyMeetingListMeta }
  | { status: "empty"; meta: AdminStudyMeetingListMeta }
  | { status: "error"; message: string };

type MeetingDialogState =
  | { mode: "create"; meeting: null }
  | { mode: "edit"; meeting: AdminStudyMeeting };

type ActionInFlight =
  | { type: "create" }
  | { type: "edit"; meetingId: string }
  | { type: "cancel"; meetingId: string }
  | null;

const DEFAULT_DRAFT_FILTERS: DraftFilters = {
  includeCanceled: DEFAULT_FILTERS.includeCanceled,
  sortOrder: DEFAULT_FILTERS.sortOrder,
  pageSize: "10",
};

const sortOrderOptions = [
  { label: "Mais antigos primeiro", value: "asc" },
  { label: "Mais recentes primeiro", value: "desc" },
];

const pageSizeOptions = [
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

const statusLabels: Record<AdminStudyMeetingDerivedStatus, string> = {
  scheduled: "Agendado",
  in_progress: "Em andamento",
  ended: "Encerrado",
  canceled: "Cancelado",
};

const statusTone: Record<AdminStudyMeetingDerivedStatus, "upcoming" | "active" | "published" | "attention"> = {
  scheduled: "upcoming",
  in_progress: "active",
  ended: "published",
  canceled: "attention",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatDateTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return dateFormatter.format(date);
};

const formatPaginationSummary = (meta: AdminStudyMeetingListMeta) => {
  const totalLabel = meta.total === 1 ? "encontro" : "encontros";

  if (meta.total === 0) {
    return `0 ${totalLabel}`;
  }

  return `Página ${meta.page} de ${meta.totalPages} · ${meta.total} ${totalLabel}`;
};

const normalizeDraftFilters = (draft: DraftFilters): AppliedFilters => ({
  includeCanceled: draft.includeCanceled,
  sortOrder: draft.sortOrder,
  pageSize: Number(draft.pageSize),
  page: 1,
});

const toListParams = (filters: AppliedFilters): AdminStudyMeetingListParams => ({
  includeCanceled: filters.includeCanceled,
  sortOrder: filters.sortOrder,
  pageSize: filters.pageSize,
  page: filters.page,
});

const isDefaultDraft = (draft: DraftFilters) =>
  draft.includeCanceled === DEFAULT_DRAFT_FILTERS.includeCanceled &&
  draft.sortOrder === DEFAULT_DRAFT_FILTERS.sortOrder &&
  draft.pageSize === DEFAULT_DRAFT_FILTERS.pageSize;

const isDefaultAppliedFilters = (filters: AppliedFilters) =>
  filters.includeCanceled === DEFAULT_FILTERS.includeCanceled &&
  filters.sortOrder === DEFAULT_FILTERS.sortOrder &&
  filters.pageSize === DEFAULT_FILTERS.pageSize &&
  filters.page === DEFAULT_FILTERS.page;

const getGroupListErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.code === "AUTH_REQUIRED") {
      return "Sua sessão expirou. Faça login novamente para carregar os grupos.";
    }

    if (error.code === "FORBIDDEN") {
      return "Seu perfil não pode consultar grupos administrativos.";
    }

    if (error.code === "PASSWORD_CHANGE_REQUIRED") {
      return "Troque sua senha temporária antes de consultar os grupos.";
    }

    if (error.kind === "network") {
      return "Não foi possível conectar ao backend local para carregar os grupos.";
    }
  }

  return "Não foi possível carregar os grupos administrativos agora.";
};

const getMeetingsErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.retryAfterSeconds) {
      return `Muitas consultas foram solicitadas. Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }

    if (error.kind === "network") {
      return "Não foi possível conectar ao backend local para carregar os encontros.";
    }

    switch (error.code) {
      case "AUTH_REQUIRED":
        return "Sua sessão expirou. Faça login novamente para carregar a agenda.";
      case "FORBIDDEN":
        return "Seu perfil não pode consultar a agenda administrativa.";
      case "STUDY_GROUP_NOT_FOUND":
        return "Grupo não encontrado para consultar a agenda.";
      case "INVALID_STUDY_MEETING_LIST_INPUT":
        return "Revise os filtros da agenda e tente novamente.";
      case "ADMIN_STUDY_MEETING_RATE_LIMITED":
        return "Muitas consultas foram solicitadas. Aguarde e tente novamente.";
      default:
        return "Não foi possível carregar os encontros agora.";
    }
  }

  return "Não foi possível carregar os encontros agora.";
};

const getMeetingActionErrorMessage = (error: unknown) => {
  if (error instanceof ServiceRequestError) {
    if (error.retryAfterSeconds) {
      return `Muitas solicitações foram enviadas. Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }

    if (error.kind === "network") {
      return "Não foi possível conectar ao backend local. Revise os dados e tente novamente.";
    }

    switch (error.code) {
      case "AUTH_REQUIRED":
        return "Sua sessão expirou. Faça login novamente para alterar a agenda.";
      case "FORBIDDEN":
        return "Seu perfil não pode alterar a agenda administrativa.";
      case "INVALID_STUDY_MEETING_INPUT":
      case "INVALID_STUDY_MEETING_UPDATE_INPUT":
      case "INVALID_STUDY_MEETING_CANCEL_INPUT":
        return "Revise os dados do encontro e tente novamente.";
      case "STUDY_GROUP_NOT_FOUND":
        return "Grupo não encontrado para alterar a agenda.";
      case "STUDY_MEETING_NOT_FOUND":
        return "Encontro não encontrado. Recarregue a agenda para consultar o estado atual.";
      case "STUDY_GROUP_INACTIVE":
        return "O grupo está inativo para esta operação.";
      case "STUDY_MEETING_ALREADY_CANCELED":
        return "Este encontro já foi cancelado. Recarregue a agenda para consultar o estado atual.";
      case "STUDY_MEETING_ALREADY_STARTED":
        return "Este encontro já começou e não pode mais ser alterado por esta ação.";
      case "STUDY_MEETING_ALREADY_ENDED":
        return "Este encontro já terminou e não pode mais ser alterado por esta ação.";
      case "STUDY_MEETING_STARTS_IN_PAST":
        return "O início do encontro precisa estar no futuro.";
      case "STUDY_MEETING_NO_CHANGES":
        return "Altere pelo menos um campo antes de salvar.";
      case "STUDY_MEETING_CONFLICT":
        return "Há conflito temporal com outro encontro do grupo. Ajuste os horários ou recarregue a agenda.";
      case "ADMIN_STUDY_MEETING_RATE_LIMITED":
        return "Muitas solicitações foram enviadas. Aguarde e tente novamente.";
      default:
        return "Não foi possível alterar a agenda agora.";
    }
  }

  return "Não foi possível alterar a agenda agora.";
};

const findSelectedGroup = (groups: AdminSelectableGroup[], selectedGroupSlug: string | null) => {
  if (!selectedGroupSlug) {
    return null;
  }

  return groups.find((group) => group.slug === selectedGroupSlug) ?? null;
};

interface AdminGroupsPageProps {
  now?: Date;
}

export const AdminGroupsPage = ({ now }: AdminGroupsPageProps = {}) => {
  const currentNow = now ?? new Date();
  const [groupsState, setGroupsState] = useState<GroupsState>({ status: "loading" });
  const [meetingsState, setMeetingsState] = useState<MeetingsState>({ status: "idle" });
  const [selectedGroupSlug, setSelectedGroupSlug] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(DEFAULT_DRAFT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [meetingDialog, setMeetingDialog] = useState<MeetingDialogState | null>(null);
  const [cancelDialogMeeting, setCancelDialogMeeting] = useState<AdminStudyMeeting | null>(null);
  const [actionInFlight, setActionInFlight] = useState<ActionInFlight>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const selectedGroupSlugRef = useRef<string | null>(null);
  const groupsRequestIdRef = useRef(0);
  const meetingsRequestIdRef = useRef(0);
  const actionIdRef = useRef(0);
  const actionInFlightRef = useRef(false);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedGroup =
    groupsState.status === "success"
      ? findSelectedGroup(groupsState.items, selectedGroupSlug)
      : null;
  const isDemoMode =
    groupsState.status === "success"
      ? groupsState.source === "demo"
      : appConfig.appMode === "demo" || appConfig.isGithubPages;
  const isActionInFlight = Boolean(actionInFlight);
  const canMutateMeetings = !isDemoMode && !isActionInFlight;
  const canCreateMeeting = Boolean(
    selectedGroup && selectedGroup.status === "active" && canMutateMeetings,
  );

  const loadMeetings = useCallback(
    async (
      groupSlug: string,
      filters: AppliedFilters,
      options: { allowPageCorrection?: boolean; showLoading?: boolean } = {},
    ) => {
      const requestId = meetingsRequestIdRef.current + 1;
      meetingsRequestIdRef.current = requestId;

      if (options.showLoading !== false) {
        setMeetingsState({ status: "loading" });
      }

      try {
        const result = await listAdminStudyMeetings(groupSlug, toListParams(filters));

        if (!mountedRef.current || requestId !== meetingsRequestIdRef.current) {
          return;
        }

        if (
          options.allowPageCorrection !== false &&
          result.meta.totalPages > 0 &&
          result.meta.page > result.meta.totalPages
        ) {
          const correctedFilters = { ...filters, page: result.meta.totalPages };
          setAppliedFilters(correctedFilters);
          void loadMeetings(groupSlug, correctedFilters, { allowPageCorrection: false });
          return;
        }

        setMeetingsState(
          result.items.length > 0
            ? { status: "success", items: result.items, meta: result.meta }
            : { status: "empty", meta: result.meta },
        );
      } catch (error) {
        if (!mountedRef.current || requestId !== meetingsRequestIdRef.current) {
          return;
        }

        setMeetingsState({ status: "error", message: getMeetingsErrorMessage(error) });
      }
    },
    [],
  );

  const loadGroups = useCallback(async () => {
    const requestId = groupsRequestIdRef.current + 1;
    groupsRequestIdRef.current = requestId;
    setGroupsState({ status: "loading" });

    try {
      const result = await listAdminSelectableGroups("all");

      if (!mountedRef.current || requestId !== groupsRequestIdRef.current) {
        return;
      }

      if (result.items.length === 0) {
        setGroupsState({ status: "empty", source: result.source });
        selectedGroupSlugRef.current = null;
        setSelectedGroupSlug(null);
        setMeetingsState({ status: "idle" });
        return;
      }

      const currentSelectedGroupSlug = selectedGroupSlugRef.current;
      const nextSelectedGroupSlug = currentSelectedGroupSlug && result.items.some((group) => group.slug === currentSelectedGroupSlug)
        ? currentSelectedGroupSlug
        : result.items[0].slug;

      setGroupsState({ status: "success", items: result.items, source: result.source });
      selectedGroupSlugRef.current = nextSelectedGroupSlug;
      setSelectedGroupSlug(nextSelectedGroupSlug);
      setAppliedFilters((currentFilters) => {
        const nextFilters = { ...currentFilters, page: 1 };
        void loadMeetings(nextSelectedGroupSlug, nextFilters);
        return nextFilters;
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== groupsRequestIdRef.current) {
        return;
      }

      setGroupsState({ status: "error", message: getGroupListErrorMessage(error) });
      setMeetingsState({ status: "idle" });
    }
  }, [loadMeetings]);

  useEffect(() => {
    mountedRef.current = true;
    void loadGroups();

    return () => {
      mountedRef.current = false;
    };
  }, [loadGroups]);

  const groupOptions = useMemo(() => {
    if (groupsState.status !== "success") {
      return [];
    }

    return groupsState.items.map((group) => ({
      label: `${group.name} (${group.status === "active" ? "ativo" : "inativo"})`,
      value: group.slug,
    }));
  }, [groupsState]);

  const handleRetryGroups = () => {
    void loadGroups();
  };

  const handleRetryMeetings = () => {
    if (!selectedGroupSlug || isActionInFlight) {
      return;
    }

    void loadMeetings(selectedGroupSlug, appliedFilters);
  };

  const handleApplyFilters = (event?: FormEvent<HTMLElement>) => {
    event?.preventDefault();

    if (!selectedGroupSlug) {
      return;
    }

    if (isActionInFlight) {
      return;
    }

    const nextFilters = normalizeDraftFilters(draftFilters);
    setAppliedFilters(nextFilters);
    void loadMeetings(selectedGroupSlug, nextFilters);
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_DRAFT_FILTERS);

    if (!selectedGroupSlug) {
      return;
    }

    if (isActionInFlight) {
      return;
    }

    if (isDefaultDraft(draftFilters) && isDefaultAppliedFilters(appliedFilters)) {
      return;
    }

    setAppliedFilters(DEFAULT_FILTERS);
    void loadMeetings(selectedGroupSlug, DEFAULT_FILTERS);
  };

  const handleGroupChange = (value: string) => {
    if (!value || value === selectedGroupSlug || isActionInFlight) {
      return;
    }

    const nextFilters = { ...appliedFilters, page: 1 };
    selectedGroupSlugRef.current = value;
    setSelectedGroupSlug(value);
    setAppliedFilters(nextFilters);
    void loadMeetings(value, nextFilters);
  };

  const handleGoToPage = (page: number) => {
    if (!selectedGroupSlug || page < 1 || isActionInFlight) {
      return;
    }

    const currentMeta =
      meetingsState.status === "success" || meetingsState.status === "empty"
        ? meetingsState.meta
        : null;

    if (currentMeta && currentMeta.totalPages > 0 && page > currentMeta.totalPages) {
      return;
    }

    const nextFilters = { ...appliedFilters, page };
    setAppliedFilters(nextFilters);
    void loadMeetings(selectedGroupSlug, nextFilters);
  };

  const paginationMeta =
    meetingsState.status === "success" || meetingsState.status === "empty"
      ? meetingsState.meta
      : null;
  const canGoPrevious = Boolean(paginationMeta && paginationMeta.page > 1);
  const canGoNext = Boolean(
    paginationMeta &&
      paginationMeta.totalPages > 0 &&
      paginationMeta.page < paginationMeta.totalPages,
  );
  const returnFocusToTrigger = () => {
    window.requestAnimationFrame(() => {
      dialogTriggerRef.current?.focus();
    });
  };

  const closeMeetingDialog = () => {
    if (actionInFlightRef.current) {
      return;
    }

    setMeetingDialog(null);
    setActionError(null);
    returnFocusToTrigger();
  };

  const closeCancelDialog = () => {
    if (actionInFlightRef.current) {
      return;
    }

    setCancelDialogMeeting(null);
    setActionError(null);
    returnFocusToTrigger();
  };

  const openMeetingDialog = (
    mode: AdminMeetingDialogMode,
    meeting: AdminStudyMeeting | null,
    triggerButton: HTMLButtonElement,
  ) => {
    if (!selectedGroup || !canMutateMeetings || cancelDialogMeeting || meetingDialog) {
      return;
    }

    if (mode === "create" && selectedGroup.status !== "active") {
      return;
    }

    if (mode === "edit") {
      if (!meeting || selectedGroup.status !== "active" || !canEditAdminStudyMeeting(meeting, currentNow)) {
        return;
      }
    }

    dialogTriggerRef.current = triggerButton;
    setActionNotice(null);
    setActionError(null);
    setMeetingDialog(
      mode === "create"
        ? { mode: "create", meeting: null }
        : { mode: "edit", meeting: meeting as AdminStudyMeeting },
    );
  };

  const openCancelDialog = (
    meeting: AdminStudyMeeting,
    triggerButton: HTMLButtonElement,
  ) => {
    if (!canMutateMeetings || cancelDialogMeeting || meetingDialog) {
      return;
    }

    if (!canCancelAdminStudyMeeting(meeting, currentNow)) {
      return;
    }

    dialogTriggerRef.current = triggerButton;
    setActionNotice(null);
    setActionError(null);
    setCancelDialogMeeting(meeting);
  };

  const runSuccessfulRefetch = (groupSlug: string, filters: AppliedFilters) => {
    void loadMeetings(groupSlug, filters, { showLoading: false });
  };

  const handleMeetingDialogSubmit = async (
    input: CreateAdminStudyMeetingInput | UpdateAdminStudyMeetingInput,
  ) => {
    if (!meetingDialog || !selectedGroupSlug || actionInFlightRef.current || isDemoMode) {
      return;
    }

    const groupSlug = selectedGroupSlug;
    const filters = appliedFilters;
    const actionId = actionIdRef.current + 1;
    actionIdRef.current = actionId;
    actionInFlightRef.current = true;
    setActionError(null);
    setActionNotice(null);
    setActionInFlight(
      meetingDialog.mode === "create"
        ? { type: "create" }
        : { type: "edit", meetingId: meetingDialog.meeting.id },
    );

    try {
      if (meetingDialog.mode === "create") {
        await createAdminStudyMeeting(groupSlug, input as CreateAdminStudyMeetingInput);
      } else {
        await updateAdminStudyMeeting(
          groupSlug,
          meetingDialog.meeting.id,
          input as UpdateAdminStudyMeetingInput,
        );
      }

      if (
        !mountedRef.current ||
        actionId !== actionIdRef.current ||
        selectedGroupSlugRef.current !== groupSlug
      ) {
        return;
      }

      setMeetingDialog(null);
      setActionNotice(
        meetingDialog.mode === "create"
          ? "Encontro criado com sucesso."
          : "Encontro atualizado com sucesso.",
      );
      returnFocusToTrigger();
      runSuccessfulRefetch(groupSlug, filters);
    } catch (error) {
      if (!mountedRef.current || actionId !== actionIdRef.current) {
        return;
      }

      setActionError(getMeetingActionErrorMessage(error));
    } finally {
      actionInFlightRef.current = false;

      if (mountedRef.current && actionId === actionIdRef.current) {
        setActionInFlight(null);
      }
    }
  };

  const handleCancelDialogConfirm = async (input: CancelAdminStudyMeetingInput) => {
    if (!cancelDialogMeeting || !selectedGroupSlug || actionInFlightRef.current || isDemoMode) {
      return;
    }

    const groupSlug = selectedGroupSlug;
    const filters = appliedFilters;
    const meetingId = cancelDialogMeeting.id;
    const actionId = actionIdRef.current + 1;
    actionIdRef.current = actionId;
    actionInFlightRef.current = true;
    setActionError(null);
    setActionNotice(null);
    setActionInFlight({ type: "cancel", meetingId });

    try {
      await cancelAdminStudyMeeting(groupSlug, meetingId, input);

      if (
        !mountedRef.current ||
        actionId !== actionIdRef.current ||
        selectedGroupSlugRef.current !== groupSlug
      ) {
        return;
      }

      setCancelDialogMeeting(null);
      setActionNotice("Encontro cancelado com sucesso.");
      returnFocusToTrigger();
      runSuccessfulRefetch(groupSlug, filters);
    } catch (error) {
      if (!mountedRef.current || actionId !== actionIdRef.current) {
        return;
      }

      setActionError(getMeetingActionErrorMessage(error));
    } finally {
      actionInFlightRef.current = false;

      if (mountedRef.current && actionId === actionIdRef.current) {
        setActionInFlight(null);
      }
    }
  };

  const buildDialogInitialValues = (meeting: AdminStudyMeeting): AdminMeetingDialogValues => ({
    title: meeting.title,
    description: meeting.description,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
  });

  return (
    <div className="page-shell admin-page">
      <ProfileHeader
        badge="Área Administrativa"
        description="Selecione um grupo para consultar a agenda administrativa de encontros, com paginação, ordenação e histórico de cancelamentos."
        eyebrow="Agenda e operação"
        meta={[
          { label: "Grupos", value: groupsState.status === "success" ? String(groupsState.items.length) : "—" },
          { label: "Modo", value: isDemoMode ? "demonstrativo" : "local" },
        ]}
        title="Encontros dos grupos"
      />

      {isDemoMode ? (
        <AlertBox title="Modo demonstrativo" tone="info">
          A agenda usa dados demonstrativos somente leitura. Criação, edição e cancelamento não
          estão disponíveis nesta etapa.
        </AlertBox>
      ) : null}

      {groupsState.status === "loading" ? (
        <LoadingState
          description="Consultando os grupos administrativos disponíveis para agenda."
          title="Carregando grupos"
        />
      ) : null}

      {groupsState.status === "error" ? (
        <EmptyState
          action={<Button onClick={handleRetryGroups}>Tentar carregar grupos</Button>}
          description={groupsState.message}
          title="Não foi possível carregar os grupos"
        />
      ) : null}

      {groupsState.status === "empty" ? (
        <EmptyState
          description="Nenhum grupo administrativo foi encontrado para consultar encontros."
          title="Nenhum grupo disponível"
        />
      ) : null}

      {groupsState.status === "success" ? (
        <section className="page-section admin-overview" id="admin-grupos">
          <Card className="admin-filters-card">
            <form className="teacher-form-grid" onSubmit={handleApplyFilters}>
              <Select
                disabled={isActionInFlight}
                helperText="O identificador usado na agenda é o slug do grupo."
                id="admin-meetings-group"
                label="Grupo"
                onChange={(event) => handleGroupChange(event.target.value)}
                options={groupOptions}
                value={selectedGroupSlug ?? ""}
              />
              <Select
                disabled={isActionInFlight}
                id="admin-meetings-sort-order"
                label="Ordenação"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sortOrder: event.target.value as SortOrder,
                  }))
                }
                options={sortOrderOptions}
                value={draftFilters.sortOrder}
              />
              <Select
                disabled={isActionInFlight}
                id="admin-meetings-page-size"
                label="Itens por página"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    pageSize: event.target.value as DraftFilters["pageSize"],
                  }))
                }
                options={pageSizeOptions}
                value={draftFilters.pageSize}
              />
              <label className="field" htmlFor="admin-meetings-include-canceled">
                <span className="field__label">Cancelados</span>
                <span className="field__control field__control--checkbox">
                  <input
                    checked={draftFilters.includeCanceled}
                    disabled={isActionInFlight}
                    id="admin-meetings-include-canceled"
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        includeCanceled: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Incluir encontros cancelados
                </span>
              </label>
              <div className="button-row">
                <Button disabled={isActionInFlight} type="submit">Aplicar filtros</Button>
                <Button disabled={isActionInFlight} onClick={handleClearFilters} variant="secondary">
                  Limpar filtros
                </Button>
              </div>
            </form>
          </Card>

          {actionNotice ? (
            <AlertBox title="Agenda atualizada" tone="success">
              {actionNotice}
            </AlertBox>
          ) : null}

          {!meetingDialog && !cancelDialogMeeting && actionError ? (
            <AlertBox title="Não foi possível alterar a agenda" tone="warning">
              {actionError}
            </AlertBox>
          ) : null}

          {selectedGroup ? (
            <>
              <div className="admin-group-card__meta">
                <Badge tone={selectedGroup.status === "active" ? "success" : "sand"}>
                  {selectedGroup.status === "active" ? "Grupo ativo" : "Grupo inativo"}
                </Badge>
                <Badge tone="brand">Slug: {selectedGroup.slug}</Badge>
              </div>
              {selectedGroup.status === "active" && !isDemoMode ? (
                <div className="button-row">
                  <Button
                    disabled={!canCreateMeeting}
                    onClick={(event) =>
                      openMeetingDialog("create", null, event.currentTarget)
                    }
                  >
                    Novo encontro
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {selectedGroup?.status === "inactive" ? (
            <AlertBox title="Grupo inativo" tone="warning">
              A consulta da agenda continua disponível, mas novas alterações administrativas ficarão
              indisponíveis enquanto o grupo permanecer inativo.
            </AlertBox>
          ) : null}

          {meetingsState.status === "loading" ? (
            <LoadingState
              description="Consultando encontros do grupo selecionado."
              title="Carregando encontros"
            />
          ) : null}

          {meetingsState.status === "error" ? (
            <EmptyState
              action={<Button onClick={handleRetryMeetings}>Tentar carregar encontros</Button>}
              description={meetingsState.message}
              title="Não foi possível carregar os encontros"
            />
          ) : null}

          {meetingsState.status === "empty" ? (
            <EmptyState
              description="Nenhum encontro foi encontrado para o grupo e filtros selecionados."
              title="Agenda vazia"
            />
          ) : null}

          {meetingsState.status === "success" ? (
            <div className="page-stack" aria-live="polite">
              {meetingsState.items.map((meeting) => {
                const derivedStatus = getAdminStudyMeetingDerivedStatus(meeting, currentNow);
                const showEditAction = Boolean(
                  selectedGroup?.status === "active" &&
                    !isDemoMode &&
                    canEditAdminStudyMeeting(meeting, currentNow),
                );
                const showCancelAction = Boolean(
                  !isDemoMode && canCancelAdminStudyMeeting(meeting, currentNow),
                );

                return (
                  <Card className="admin-group-card" key={meeting.id}>
                    <div className="admin-group-card__header">
                      <div>
                        <h2>{meeting.title}</h2>
                        {meeting.description ? <p>{meeting.description}</p> : null}
                      </div>
                      <StatusTag
                        label={statusLabels[derivedStatus]}
                        tone={statusTone[derivedStatus]}
                      />
                    </div>
                    <dl className="profile-header__meta">
                      <div className="profile-header__meta-item">
                        <dt>Início</dt>
                        <dd>{formatDateTime(meeting.startsAt)}</dd>
                      </div>
                      <div className="profile-header__meta-item">
                        <dt>Término</dt>
                        <dd>{formatDateTime(meeting.endsAt)}</dd>
                      </div>
                    </dl>
                    {meeting.cancellationReason ? (
                      <AlertBox title="Motivo do cancelamento" tone="warning">
                        {meeting.cancellationReason}
                      </AlertBox>
                    ) : null}
                    {showEditAction || showCancelAction ? (
                      <div className="button-row admin-user-card__actions">
                        {showEditAction ? (
                          <Button
                            disabled={isActionInFlight}
                            onClick={(event) =>
                              openMeetingDialog("edit", meeting, event.currentTarget)
                            }
                            size="compact"
                            variant="secondary"
                          >
                            Editar
                          </Button>
                        ) : null}
                        {showCancelAction ? (
                          <Button
                            disabled={isActionInFlight}
                            onClick={(event) =>
                              openCancelDialog(meeting, event.currentTarget)
                            }
                            size="compact"
                            variant="secondary"
                          >
                            Cancelar encontro
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : null}

          {paginationMeta ? (
            <Card className="admin-pagination-card" tone="soft">
              <p>{formatPaginationSummary(paginationMeta)}</p>
              <div className="button-row">
                <Button
                  disabled={!canGoPrevious || isActionInFlight}
                  onClick={() => handleGoToPage((paginationMeta?.page ?? 1) - 1)}
                  variant="secondary"
                >
                  Página anterior
                </Button>
                <Button
                  disabled={!canGoNext || isActionInFlight}
                  onClick={() => handleGoToPage((paginationMeta?.page ?? 1) + 1)}
                  variant="secondary"
                >
                  Próxima página
                </Button>
              </div>
            </Card>
          ) : null}
        </section>
      ) : null}

      {meetingDialog && selectedGroup ? (
        <AdminMeetingDialog
          dialogError={actionError}
          groupName={selectedGroup.name}
          initialValues={
            meetingDialog.mode === "edit"
              ? buildDialogInitialValues(meetingDialog.meeting)
              : undefined
          }
          isSubmitting={
            actionInFlight?.type === "create" || actionInFlight?.type === "edit"
          }
          mode={meetingDialog.mode}
          now={currentNow}
          onCancel={closeMeetingDialog}
          onSubmit={(input) => void handleMeetingDialogSubmit(input)}
        />
      ) : null}

      {cancelDialogMeeting ? (
        <AdminMeetingCancelDialog
          dialogError={actionError}
          formattedStartsAt={formatDateTime(cancelDialogMeeting.startsAt)}
          isSubmitting={actionInFlight?.type === "cancel"}
          meeting={cancelDialogMeeting}
          onCancel={closeCancelDialog}
          onConfirm={(input) => void handleCancelDialogConfirm(input)}
        />
      ) : null}
    </div>
  );
};
