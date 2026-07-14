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
import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import { ServiceRequestError } from "../services/api";
import type {
  AccountInvitationDeliveryStatus,
  AccountInvitationLifecycleStatus,
  AccountInvitationListItem,
  AccountInvitationListMeta,
  AccountInvitationSortBy,
  AccountInvitationType,
  SortOrder,
} from "../types/adminAccountInvitations";

const DEFAULT_QUERY = {
  search: undefined,
  deliveryStatus: undefined,
  lifecycleStatus: undefined,
  invitationType: undefined,
  sortBy: "createdAt",
  sortOrder: "desc",
  pageSize: 10,
  page: 1,
} as const;

const DEFAULT_DRAFT = {
  draftSearch: "",
  draftDeliveryStatus: "",
  draftLifecycleStatus: "",
  draftInvitationType: "",
  draftSortBy: "createdAt",
  draftSortOrder: "desc",
  draftPageSize: "10",
} as const;

type AppliedQuery = {
  search?: string;
  deliveryStatus?: AccountInvitationDeliveryStatus;
  lifecycleStatus?: AccountInvitationLifecycleStatus;
  invitationType?: AccountInvitationType;
  sortBy: AccountInvitationSortBy;
  sortOrder: SortOrder;
  pageSize: number;
  page: number;
};

type DraftFilters = {
  draftSearch: string;
  draftDeliveryStatus: "" | AccountInvitationDeliveryStatus;
  draftLifecycleStatus: "" | AccountInvitationLifecycleStatus;
  draftInvitationType: "" | AccountInvitationType;
  draftSortBy: AccountInvitationSortBy;
  draftSortOrder: SortOrder;
  draftPageSize: "10" | "25" | "50";
};

type PageState =
  | { status: "loading" }
  | {
      status: "success";
      items: AccountInvitationListItem[];
      meta: AccountInvitationListMeta;
    }
  | { status: "empty"; meta: AccountInvitationListMeta }
  | { status: "error"; message: string };

type PublicInvitationReference = Pick<
  AccountInvitationListItem,
  "id" | "recipientName" | "recipientEmailMasked"
>;

type InvitationAction =
  | { type: "cancel"; invitation: PublicInvitationReference }
  | { type: "resend"; invitation: PublicInvitationReference }
  | null;

type ActionInFlight =
  | { type: "cancel"; invitationId: string }
  | { type: "resend"; invitationId: string }
  | null;

const invitationTypeLabels: Record<AccountInvitationType, string> = {
  enrollment_approval: "Aprovação de inscrição",
  admin_reinvite: "Reconvite administrativo",
};

const deliveryStatusLabels: Record<AccountInvitationDeliveryStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falha no envio",
  not_configured: "E-mail não configurado",
};

const lifecycleStatusLabels: Record<AccountInvitationLifecycleStatus, string> = {
  pending: "Aguardando aceite",
  accepted: "Aceito",
  expired: "Expirado",
  canceled: "Cancelado",
};

const deliveryBadgeTone: Record<AccountInvitationDeliveryStatus, "neutral" | "brand" | "sand" | "success"> = {
  pending: "sand",
  sent: "success",
  failed: "neutral",
  not_configured: "brand",
};

const lifecycleStatusTone: Record<AccountInvitationLifecycleStatus, "draft" | "published" | "attention"> = {
  pending: "draft",
  accepted: "published",
  expired: "attention",
  canceled: "attention",
};

const deliveryStatusOptions = [
  { label: "Todos", value: "" },
  { label: "Pendente", value: "pending" },
  { label: "Enviado", value: "sent" },
  { label: "Falha no envio", value: "failed" },
  { label: "E-mail não configurado", value: "not_configured" },
];

const lifecycleStatusOptions = [
  { label: "Todos", value: "" },
  { label: "Aguardando aceite", value: "pending" },
  { label: "Aceito", value: "accepted" },
  { label: "Expirado", value: "expired" },
  { label: "Cancelado", value: "canceled" },
];

const invitationTypeOptions = [
  { label: "Todos", value: "" },
  { label: "Aprovação de inscrição", value: "enrollment_approval" },
  { label: "Reconvite administrativo", value: "admin_reinvite" },
];

const sortByOptions = [
  { label: "Data de criação", value: "createdAt" },
  { label: "Data de expiração", value: "expiresAt" },
  { label: "Destinatário", value: "recipient" },
];

const sortOrderOptions = [
  { label: "Mais recentes primeiro", value: "desc" },
  { label: "Mais antigos primeiro", value: "asc" },
];

const pageSizeOptions = [
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateFormatter.format(date);
};

const formatInvitedBy = (value: string | null) => {
  return value && value.trim() ? value : "—";
};

const formatPaginationSummary = (meta: AccountInvitationListMeta) => {
  const totalLabel = meta.total === 1 ? "convite" : "convites";

  if (meta.total === 0) {
    return `0 ${totalLabel}`;
  }

  return `Página ${meta.page} de ${meta.totalPages} · ${meta.total} ${totalLabel}`;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível carregar os convites agora.";
};

const normalizeDraftFilters = (draft: DraftFilters): AppliedQuery => {
  const trimmedSearch = draft.draftSearch.trim();

  return {
    search: trimmedSearch || undefined,
    deliveryStatus: draft.draftDeliveryStatus || undefined,
    lifecycleStatus: draft.draftLifecycleStatus || undefined,
    invitationType: draft.draftInvitationType || undefined,
    sortBy: draft.draftSortBy,
    sortOrder: draft.draftSortOrder,
    pageSize: Number(draft.draftPageSize),
    page: 1,
  };
};

const toListParams = (query: AppliedQuery) => ({
  ...(query.search ? { search: query.search } : {}),
  ...(query.deliveryStatus ? { deliveryStatus: query.deliveryStatus } : {}),
  ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
  ...(query.invitationType ? { invitationType: query.invitationType } : {}),
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
  pageSize: query.pageSize,
  page: query.page,
});

const isDefaultDraft = (draft: DraftFilters) => {
  return (
    draft.draftSearch === DEFAULT_DRAFT.draftSearch &&
    draft.draftDeliveryStatus === DEFAULT_DRAFT.draftDeliveryStatus &&
    draft.draftLifecycleStatus === DEFAULT_DRAFT.draftLifecycleStatus &&
    draft.draftInvitationType === DEFAULT_DRAFT.draftInvitationType &&
    draft.draftSortBy === DEFAULT_DRAFT.draftSortBy &&
    draft.draftSortOrder === DEFAULT_DRAFT.draftSortOrder &&
    draft.draftPageSize === DEFAULT_DRAFT.draftPageSize
  );
};

const isDefaultAppliedQuery = (query: AppliedQuery) => {
  return (
    query.search === DEFAULT_QUERY.search &&
    query.deliveryStatus === DEFAULT_QUERY.deliveryStatus &&
    query.lifecycleStatus === DEFAULT_QUERY.lifecycleStatus &&
    query.invitationType === DEFAULT_QUERY.invitationType &&
    query.sortBy === DEFAULT_QUERY.sortBy &&
    query.sortOrder === DEFAULT_QUERY.sortOrder &&
    query.pageSize === DEFAULT_QUERY.pageSize &&
    query.page === DEFAULT_QUERY.page
  );
};

export const AdminAccountInvitationsPage = () => {
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [appliedQuery, setAppliedQuery] = useState<AppliedQuery>(DEFAULT_QUERY);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [confirmationAction, setConfirmationAction] = useState<InvitationAction>(null);
  const [actionInFlight, setActionInFlight] = useState<ActionInFlight>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadInvitations = useCallback(
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
        const result = await listAdminAccountInvitations(toListParams(query));

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
          void loadInvitations(correctedQuery, { allowPageCorrection: false });
          return;
        }

        setState(
          result.items.length > 0
            ? { status: "success", items: result.items, meta: result.meta }
            : { status: "empty", meta: result.meta },
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
    void loadInvitations(DEFAULT_QUERY);

    return () => {
      mountedRef.current = false;
    };
  }, [loadInvitations]);

  const applyQuery = (query: AppliedQuery) => {
    setAppliedQuery(query);
    void loadInvitations(query);
  };

  const handleApplyFilters = (event?: FormEvent<HTMLElement>) => {
    event?.preventDefault();
    if (actionInFlight) {
      return;
    }
    applyQuery(normalizeDraftFilters(draftFilters));
  };

  const handleClearFilters = () => {
    if (actionInFlight) {
      return;
    }

    setDraftFilters(DEFAULT_DRAFT);

    if (isDefaultDraft(draftFilters) && isDefaultAppliedQuery(appliedQuery)) {
      return;
    }

    applyQuery(DEFAULT_QUERY);
  };

  const handleGoToPage = (page: number) => {
    if (actionInFlight) {
      return;
    }

    applyQuery({ ...appliedQuery, page });
  };

  const openCancellationConfirmation = (invitation: AccountInvitationListItem) => {
    if (actionInFlight || invitation.lifecycleStatus !== "pending") {
      return;
    }

    setActionError(null);
    setActionNotice(null);
    setConfirmationAction({
      type: "cancel",
      invitation: {
        id: invitation.id,
        recipientName: invitation.recipientName,
        recipientEmailMasked: invitation.recipientEmailMasked,
      },
    });
  };

  const openResendConfirmation = (invitation: AccountInvitationListItem) => {
    if (actionInFlight || invitation.lifecycleStatus === "accepted") {
      return;
    }

    setActionError(null);
    setActionNotice(null);
    setConfirmationAction({
      type: "resend",
      invitation: {
        id: invitation.id,
        recipientName: invitation.recipientName,
        recipientEmailMasked: invitation.recipientEmailMasked,
      },
    });
  };

  const closeConfirmation = () => {
    if (actionInFlight) {
      return;
    }

    setConfirmationAction(null);
  };

  const getCancellationErrorMessage = (error: unknown) => {
    if (
      error instanceof ServiceRequestError &&
      error.code === "ACCOUNT_INVITATION_NOT_CANCELABLE"
    ) {
      return "Este convite não pode mais ser cancelado. Atualize a lista para consultar o estado atual.";
    }

    return getErrorMessage(error);
  };

  const getResendErrorMessage = (error: unknown) => {
    if (
      error instanceof ServiceRequestError &&
      error.code === "ACCOUNT_INVITATION_NOT_RESENDABLE"
    ) {
      return "Este convite não pode mais ser reenviado. Atualize a lista para consultar o estado atual.";
    }

    return getErrorMessage(error);
  };

  const getResendSuccessMessage = (deliveryStatus: AccountInvitationDeliveryStatus) => {
    if (deliveryStatus === "pending") {
      return "Reenvio processado e aguardando confirmação de entrega.";
    }

    if (deliveryStatus === "failed") {
      return "Novo convite criado, mas o envio do e-mail falhou.";
    }

    if (deliveryStatus === "not_configured") {
      return "Novo convite criado, mas o envio de e-mail não está configurado.";
    }

    return "Convite reenviado com sucesso.";
  };

  const handleConfirmAction = async () => {
    if (!confirmationAction || actionInFlight) {
      return;
    }

    const { type, invitation } = confirmationAction;
    const invitationId = invitation.id;
    setActionInFlight({ type, invitationId });
    setActionError(null);
    setActionNotice(null);

    try {
      let successNotice = "Convite cancelado com sucesso.";

      if (type === "cancel") {
        await cancelAdminAccountInvitation(invitationId);
      } else {
        const result = await resendAdminAccountInvitation(invitationId);
        successNotice = getResendSuccessMessage(result.invitation.deliveryStatus);
      }

      if (!mountedRef.current) {
        return;
      }

      setConfirmationAction(null);
      setActionInFlight(null);
      setActionNotice(successNotice);
      void loadInvitations(appliedQuery, { showLoading: false });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setActionInFlight(null);
      setConfirmationAction(null);
      setActionError(
        type === "cancel"
          ? {
              title: "Não foi possível cancelar o convite",
              message: getCancellationErrorMessage(error),
            }
          : {
              title: "Não foi possível reenviar o convite",
              message: getResendErrorMessage(error),
            },
      );
    }
  };

  const currentMeta =
    state.status === "success" || state.status === "empty" ? state.meta : null;
  const isLoading = state.status === "loading";
  const isActionInFlight = Boolean(actionInFlight);
  const isCanceling = actionInFlight?.type === "cancel";
  const isResending = actionInFlight?.type === "resend";
  const canGoPrevious = Boolean(currentMeta && currentMeta.page > 1 && !isLoading && !isActionInFlight);
  const canGoNext = Boolean(
    currentMeta &&
      currentMeta.totalPages > 0 &&
      currentMeta.page < currentMeta.totalPages &&
      !isLoading &&
      !isActionInFlight,
  );

  const renderPaginationSummary = (meta: AccountInvitationListMeta) => (
    <p className="card-subtitle">{formatPaginationSummary(meta)}</p>
  );

  const renderPaginationControls = () => (
    <nav aria-label="Paginação de convites administrativos">
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

  const renderInvitation = (invitation: AccountInvitationListItem) => (
    <Card as="article" className="admin-user-card" key={invitation.id}>
      <div className="admin-user-card__header">
        <div>
          <p className="card-eyebrow">Convite de conta</p>
          <h3>{invitation.recipientName}</h3>
          <p>{invitation.recipientEmailMasked}</p>
        </div>
        <StatusTag
          label={lifecycleStatusLabels[invitation.lifecycleStatus]}
          tone={lifecycleStatusTone[invitation.lifecycleStatus]}
        />
      </div>

      <div className="admin-pill-row" aria-label="Classificações do convite">
        <Badge tone="brand">{invitationTypeLabels[invitation.invitationType]}</Badge>
        <Badge tone={deliveryBadgeTone[invitation.deliveryStatus]}>
          {deliveryStatusLabels[invitation.deliveryStatus]}
        </Badge>
      </div>

      <dl className="admin-user-card__meta">
        <div>
          <dt>Tipo</dt>
          <dd>{invitationTypeLabels[invitation.invitationType]}</dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>{deliveryStatusLabels[invitation.deliveryStatus]}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{lifecycleStatusLabels[invitation.lifecycleStatus]}</dd>
        </div>
        <div>
          <dt>Criado em</dt>
          <dd>{formatDate(invitation.createdAt)}</dd>
        </div>
        <div>
          <dt>Expira em</dt>
          <dd>{formatDate(invitation.expiresAt)}</dd>
        </div>
        <div>
          <dt>Convidado por</dt>
          <dd>{formatInvitedBy(invitation.invitedByName)}</dd>
        </div>
      </dl>

      {invitation.lifecycleStatus !== "accepted" ? (
        <div className="button-row admin-user-card__actions">
          {invitation.lifecycleStatus === "pending" ? (
            <Button
              disabled={isActionInFlight}
              onClick={() => openCancellationConfirmation(invitation)}
              size="compact"
              variant="secondary"
            >
              Cancelar convite
            </Button>
          ) : null}
          <Button
            disabled={isActionInFlight}
            onClick={() => openResendConfirmation(invitation)}
            size="compact"
          >
            Reenviar convite
          </Button>
        </div>
      ) : null}
    </Card>
  );

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Área administrativa"
        description="Acompanhe convites de acesso emitidos para contas administrativas sem expor dados sensíveis."
        eyebrow="Gestão de acesso"
        title="Convites de acesso"
      />

      <section
        aria-labelledby="admin-account-invitations-title"
        className="page-section admin-overview"
        id="admin-account-invitations"
      >
        <div className="section-header">
          <Badge tone="sand">Leitura inicial</Badge>
          <h2 id="admin-account-invitations-title">Convites administrativos</h2>
          <p>Lista de convites ordenada pelos mais recentes.</p>
        </div>

        <Card as="form" className="admin-settings-card" onSubmit={handleApplyFilters} tone="soft">
          <div className="teacher-form-grid admin-user-filters">
            <TextInput
              id="admin-account-invitations-search"
              label="Buscar por destinatário"
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, draftSearch: event.target.value }))
              }
              value={draftFilters.draftSearch}
            />
            <Select
              id="admin-account-invitations-delivery-status"
              label="Status de entrega"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  draftDeliveryStatus: event.target.value as DraftFilters["draftDeliveryStatus"],
                }))
              }
              options={deliveryStatusOptions}
              value={draftFilters.draftDeliveryStatus}
            />
            <Select
              id="admin-account-invitations-lifecycle-status"
              label="Ciclo de vida"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  draftLifecycleStatus: event.target.value as DraftFilters["draftLifecycleStatus"],
                }))
              }
              options={lifecycleStatusOptions}
              value={draftFilters.draftLifecycleStatus}
            />
            <Select
              id="admin-account-invitations-type"
              label="Tipo"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  draftInvitationType: event.target.value as DraftFilters["draftInvitationType"],
                }))
              }
              options={invitationTypeOptions}
              value={draftFilters.draftInvitationType}
            />
            <Select
              id="admin-account-invitations-sort-by"
              label="Ordenar por"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  draftSortBy: event.target.value as AccountInvitationSortBy,
                }))
              }
              options={sortByOptions}
              value={draftFilters.draftSortBy}
            />
            <Select
              id="admin-account-invitations-sort-order"
              label="Direção"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  draftSortOrder: event.target.value as SortOrder,
                }))
              }
              options={sortOrderOptions}
              value={draftFilters.draftSortOrder}
            />
            <Select
              id="admin-account-invitations-page-size"
              label="Tamanho da página"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  draftPageSize: event.target.value as DraftFilters["draftPageSize"],
                }))
              }
              options={pageSizeOptions}
              value={draftFilters.draftPageSize}
            />
          </div>
          <div className="button-row">
            <Button disabled={isActionInFlight} type="submit">
              Aplicar filtros
            </Button>
            <Button disabled={isActionInFlight} onClick={handleClearFilters} type="button" variant="secondary">
              Limpar filtros
            </Button>
          </div>
        </Card>

        {actionNotice ? (
          <AlertBox title="Ação concluída" tone="success">
            {actionNotice}
          </AlertBox>
        ) : null}

        {actionError ? (
          <AlertBox title={actionError.title} tone="warning">
            {actionError.message}
          </AlertBox>
        ) : null}

        {state.status === "loading" ? (
          <>
            <LoadingState description="Buscando os convites mais recentes." title="Carregando convites" />
            {renderPaginationControls()}
          </>
        ) : null}

        {state.status === "error" ? (
          <AlertBox title="Não foi possível carregar convites" tone="warning">
            <p>{state.message}</p>
            <div className="button-row">
              <Button
                disabled={isActionInFlight}
                onClick={() => void loadInvitations(appliedQuery)}
                variant="secondary"
              >
                Tentar novamente
              </Button>
            </div>
          </AlertBox>
        ) : null}

        {state.status === "empty" ? (
          <>
            {renderPaginationSummary(state.meta)}
            {renderPaginationControls()}
            <EmptyState
              description="Os convites administrativos aparecerão aqui quando forem emitidos."
              title="Nenhum convite encontrado"
            />
          </>
        ) : null}

        {state.status === "success" ? (
          <>
            {renderPaginationSummary(state.meta)}
            {renderPaginationControls()}
            <div aria-label="Lista de convites administrativos" className="page-stack">
              {state.items.map(renderInvitation)}
            </div>
          </>
        ) : null}
      </section>

      {confirmationAction ? (
        <div
          aria-labelledby={`${confirmationAction.type}-invitation-dialog-title`}
          aria-modal="true"
          className="admin-modal-backdrop"
          role="dialog"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Convite de conta</p>
            <h2 id={`${confirmationAction.type}-invitation-dialog-title`}>
              {confirmationAction.type === "cancel"
                ? `Cancelar convite de ${confirmationAction.invitation.recipientName}?`
                : `Reenviar convite para ${confirmationAction.invitation.recipientName}?`}
            </h2>
            <p>
              {confirmationAction.type === "cancel"
                ? "O convite será invalidado e não poderá mais ser aceito."
                : "Um novo convite será emitido e convites anteriores ainda ativos serão invalidados."}
            </p>
            <p>
              <strong>Destinatário:</strong> {confirmationAction.invitation.recipientEmailMasked}
            </p>

            <AlertBox title="Confirmação necessária" tone="warning">
              Esta ação usa a API administrativa como autoridade final. Se o estado do convite tiver
              mudado, a lista permanecerá preservada para atualização manual.
            </AlertBox>

            <div className="button-row">
              <Button
                disabled={isActionInFlight}
                onClick={() => void handleConfirmAction()}
              >
                {confirmationAction.type === "cancel"
                  ? isCanceling
                    ? "Cancelando..."
                    : "Confirmar cancelamento"
                  : isResending
                    ? "Reenviando..."
                    : "Confirmar reenvio"}
              </Button>
              <Button
                disabled={isActionInFlight}
                onClick={closeConfirmation}
                variant="secondary"
              >
                Manter convite
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
