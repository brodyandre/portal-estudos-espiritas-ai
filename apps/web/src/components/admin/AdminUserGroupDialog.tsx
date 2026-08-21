import { useEffect, useMemo } from "react";

import type { AdminSelectableGroup } from "../../types/adminGroups";
import type {
  AdminUserGroupSummary,
  AdminUserTeacherGroupSummary,
} from "../../types/adminUsersList";
import { AlertBox } from "../ui/AlertBox";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadingState } from "../ui/LoadingState";
import { Select } from "../ui/Select";

export const WITHOUT_GROUP_VALUE = "__without_group__";

export type GroupOptionsState =
  | { status: "idle"; items: AdminSelectableGroup[] }
  | { status: "loading"; items: AdminSelectableGroup[] }
  | { status: "success"; items: AdminSelectableGroup[]; source: "api" | "demo" }
  | { status: "error"; items: AdminSelectableGroup[]; message: string };

interface AdminUserGroupDialogProps {
  currentGroup: AdminUserGroupSummary | null;
  currentTeacherGroups: AdminUserTeacherGroupSummary[];
  currentGroupUnavailable: boolean;
  description: string;
  dialogError: string | null;
  fieldError: string | null;
  groupsState: GroupOptionsState;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  mode: "single" | "multiple";
  onCancel: () => void;
  onConfirm: () => void;
  onRetryLoad: () => void;
  onValueChange: (value: string) => void;
  onValuesChange: (values: string[]) => void;
  selectedValue: string;
  selectedValues: string[];
  userEmailMasked: string;
  userName: string;
}

const SELECT_ID = "admin-user-group-select";
const TITLE_ID = "admin-user-group-dialog-title";
const DESCRIPTION_ID = "admin-user-group-dialog-description";
const FIELD_ERROR_ID = "admin-user-group-dialog-field-error";
const CANCEL_BUTTON_ID = "admin-user-group-cancel-button";

const buildConfirmLabel = (
  currentGroup: AdminUserGroupSummary | null,
  selectedValue: string,
) => {
  if (selectedValue === WITHOUT_GROUP_VALUE) {
    return currentGroup ? "Remover vínculo" : "Salvar alteração";
  }

  return currentGroup ? "Salvar alteração" : "Vincular grupo";
};

export const AdminUserGroupDialog = ({
  currentGroup,
  currentTeacherGroups,
  currentGroupUnavailable,
  description,
  dialogError,
  fieldError,
  groupsState,
  isSubmitting,
  isSubmitDisabled,
  mode,
  onCancel,
  onConfirm,
  onRetryLoad,
  onValueChange,
  onValuesChange,
  selectedValue,
  selectedValues,
  userEmailMasked,
  userName,
}: AdminUserGroupDialogProps) => {
  const selectOptions = useMemo(
    () => [
      { label: "Sem grupo", value: WITHOUT_GROUP_VALUE },
      ...groupsState.items.map((group) => ({
        label: group.name,
        value: group.slug,
      })),
    ],
    [groupsState.items],
  );

  useEffect(() => {
    if (groupsState.status === "success" && mode === "single") {
      const selectElement = document.getElementById(SELECT_ID);

      if (selectElement instanceof HTMLSelectElement) {
        selectElement.focus();
        return;
      }
    }

    const cancelButton = document.getElementById(CANCEL_BUTTON_ID);

    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.focus();
    }
  }, [groupsState.status, mode]);

  const toggleSelectedGroup = (groupSlug: string) => {
    const nextValues = selectedValues.includes(groupSlug)
      ? selectedValues.filter((value) => value !== groupSlug)
      : [...selectedValues, groupSlug];

    onValuesChange(nextValues);
  };

  return (
    <div
      aria-describedby={DESCRIPTION_ID}
      aria-labelledby={TITLE_ID}
      aria-modal="true"
      className="admin-modal-backdrop"
      role="dialog"
    >
      <Card className="admin-modal" tone="soft">
        <p className="card-eyebrow">Vínculo de grupo</p>
        <h2 id={TITLE_ID}>
          {mode === "multiple" ? "Alterar grupos do professor" : "Alterar grupo do usuário"}
        </h2>
        <p id={DESCRIPTION_ID}>{description}</p>
        <p>
          <strong>Usuário:</strong> {userName} ({userEmailMasked})
        </p>
        <p>
          <strong>{mode === "multiple" ? "Grupos atuais:" : "Grupo atual:"}</strong>{" "}
          {mode === "multiple"
            ? currentTeacherGroups.map((group) => group.name).join(", ") || "Sem grupo vinculado"
            : currentGroup?.name ?? "Sem grupo vinculado"}
        </p>

        {currentGroupUnavailable ? (
          <AlertBox title="Grupo atual indisponível" tone="warning">
            O grupo atual não está disponível para novos vínculos. Você pode escolher outro grupo
            ativo ou remover somente o vínculo atual.
          </AlertBox>
        ) : null}

        <AlertBox title="O que esta ação faz" tone="info">
          {mode === "multiple"
            ? "Alterar estes vínculos não exclui o professor, não exclui grupos e não altera o status da conta."
            : "Remover o vínculo não exclui o usuário, não exclui o grupo e não altera o status da conta."}
        </AlertBox>

        {groupsState.status === "loading" || groupsState.status === "idle" ? (
          <LoadingState
            description="Consultando apenas os grupos ativos disponíveis para vínculo."
            title="Carregando grupos"
          />
        ) : null}

        {groupsState.status === "error" ? (
          <AlertBox title="Não foi possível carregar os grupos" tone="warning">
            <p>{groupsState.message}</p>
            <div className="button-row">
              <Button disabled={isSubmitting} onClick={onRetryLoad} variant="secondary">
                Tentar carregar grupos
              </Button>
            </div>
          </AlertBox>
        ) : null}

        {groupsState.status === "success" && mode === "single" ? (
          <>
            <Select
              aria-describedby={fieldError ? FIELD_ERROR_ID : undefined}
              aria-invalid={fieldError ? "true" : undefined}
              disabled={isSubmitting}
              id={SELECT_ID}
              label="Grupo"
              onChange={(event) => onValueChange(event.target.value)}
              options={selectOptions}
              value={selectedValue}
            />
            {fieldError ? (
              <p className="field__message field__message--error" id={FIELD_ERROR_ID}>
                {fieldError}
              </p>
            ) : null}
          </>
        ) : null}

        {groupsState.status === "success" && mode === "multiple" ? (
          <fieldset
            aria-describedby={fieldError ? FIELD_ERROR_ID : undefined}
            className="admin-user-group-checklist"
            disabled={isSubmitting}
          >
            <legend>Grupos vinculados</legend>
            {groupsState.items.length === 0 ? (
              <p className="card-subtitle">Nenhum grupo ativo disponível para vínculo.</p>
            ) : null}
            {groupsState.items.map((group) => (
              <label className="admin-user-group-checklist__item" key={group.slug}>
                <input
                  checked={selectedValues.includes(group.slug)}
                  onChange={() => toggleSelectedGroup(group.slug)}
                  type="checkbox"
                />
                <span>{group.name}</span>
              </label>
            ))}
            {fieldError ? (
              <p className="field__message field__message--error" id={FIELD_ERROR_ID}>
                {fieldError}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {dialogError ? (
          <AlertBox title="Não foi possível alterar o grupo" tone="warning">
            {dialogError}
          </AlertBox>
        ) : null}

        <div className="button-row">
          <Button disabled={isSubmitDisabled} onClick={onConfirm}>
            {isSubmitting
              ? "Salvando..."
              : mode === "multiple"
                ? "Salvar vínculos"
                : buildConfirmLabel(currentGroup, selectedValue)}
          </Button>
          <Button
            disabled={isSubmitting}
            id={CANCEL_BUTTON_ID}
            onClick={onCancel}
            variant="secondary"
          >
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  );
};
