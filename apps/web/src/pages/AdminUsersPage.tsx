import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

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
import { ServiceRequestError, formatRetryAfterLabel } from "../services/api";
import { listAdminUsersList } from "../services/adminUsersListService";
import type {
  AdminUserActivationStatus,
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

export const AdminUsersPage = () => {
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [appliedQuery, setAppliedQuery] = useState<AppliedQuery>(DEFAULT_QUERY);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

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

  useEffect(() => {
    mountedRef.current = true;
    void loadUsers(DEFAULT_QUERY);

    return () => {
      mountedRef.current = false;
    };
  }, [loadUsers]);

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

  const currentMeta = state.status === "success" || state.status === "empty" ? state.meta : null;
  const currentSource = state.status === "success" || state.status === "empty" ? state.source : null;
  const isLoading = state.status === "loading";
  const canGoPrevious = Boolean(currentMeta && currentMeta.page > 1 && !isLoading);
  const canGoNext = Boolean(
    currentMeta &&
      currentMeta.totalPages > 0 &&
      currentMeta.page < currentMeta.totalPages &&
      !isLoading,
  );

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
    </div>
  );
};
