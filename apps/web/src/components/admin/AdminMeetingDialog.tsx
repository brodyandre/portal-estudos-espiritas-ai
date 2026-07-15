import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  CreateAdminStudyMeetingInput,
  UpdateAdminStudyMeetingInput,
} from "../../types/adminStudyMeetings";
import {
  datetimeLocalToIso,
  isoToDatetimeLocalValue,
} from "../../utils/adminStudyMeetings";
import { AlertBox } from "../ui/AlertBox";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export type AdminMeetingDialogMode = "create" | "edit";

export interface AdminMeetingDialogValues {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
}

type MeetingDialogSubmitInput =
  | CreateAdminStudyMeetingInput
  | UpdateAdminStudyMeetingInput;

interface AdminMeetingDialogProps {
  dialogError: string | null;
  groupName: string;
  initialValues?: AdminMeetingDialogValues;
  isSubmitting: boolean;
  mode: AdminMeetingDialogMode;
  now: Date;
  onCancel: () => void;
  onSubmit: (input: MeetingDialogSubmitInput) => void;
}

type FieldErrors = Partial<Record<"title" | "description" | "startsAt" | "endsAt" | "form", string>>;

const TITLE_ID = "admin-meeting-dialog-title";
const DESCRIPTION_ID = "admin-meeting-dialog-description";
const TITLE_FIELD_ID = "admin-meeting-title";
const DESCRIPTION_FIELD_ID = "admin-meeting-description";
const STARTS_AT_FIELD_ID = "admin-meeting-starts-at";
const ENDS_AT_FIELD_ID = "admin-meeting-ends-at";
const FORM_ERROR_ID = "admin-meeting-form-error";

const EMPTY_VALUES = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
};

const toFormValues = (values?: AdminMeetingDialogValues) => {
  if (!values) {
    return EMPTY_VALUES;
  }

  return {
    title: values.title,
    description: values.description ?? "",
    startsAt: isoToDatetimeLocalValue(values.startsAt),
    endsAt: isoToDatetimeLocalValue(values.endsAt),
  };
};

const normalizeDescription = (value: string) => {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
};

const validateAndBuildInput = (
  values: typeof EMPTY_VALUES,
  mode: AdminMeetingDialogMode,
  now: Date,
  initialValues?: AdminMeetingDialogValues,
) => {
  const errors: FieldErrors = {};
  const title = values.title.trim();
  const description = normalizeDescription(values.description);

  if (!title) {
    errors.title = "Informe o título do encontro.";
  } else if (title.length > 120) {
    errors.title = "Use no máximo 120 caracteres no título.";
  }

  if (values.description.trim().length > 320) {
    errors.description = "Use no máximo 320 caracteres na descrição.";
  }

  let startsAt = "";
  let endsAt = "";
  let startsAtTime = Number.NaN;
  let endsAtTime = Number.NaN;

  try {
    startsAt = datetimeLocalToIso(values.startsAt);
    startsAtTime = new Date(startsAt).getTime();
  } catch {
    errors.startsAt = values.startsAt.trim()
      ? "Informe uma data de início válida."
      : "Informe o início do encontro.";
  }

  try {
    endsAt = datetimeLocalToIso(values.endsAt);
    endsAtTime = new Date(endsAt).getTime();
  } catch {
    errors.endsAt = values.endsAt.trim()
      ? "Informe uma data de término válida."
      : "Informe o término do encontro.";
  }

  if (!errors.startsAt && startsAtTime <= now.getTime()) {
    errors.startsAt = "O início precisa estar no futuro.";
  }

  if (!errors.startsAt && !errors.endsAt && endsAtTime <= startsAtTime) {
    errors.endsAt = "O término precisa ser posterior ao início.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, input: null };
  }

  const normalizedValues: AdminMeetingDialogValues = {
    title,
    description,
    startsAt,
    endsAt,
  };

  if (mode === "create") {
    return { errors, input: normalizedValues };
  }

  if (!initialValues) {
    return { errors: { form: "Não foi possível comparar os dados do encontro." }, input: null };
  }

  const input: UpdateAdminStudyMeetingInput = {};

  if (normalizedValues.title !== initialValues.title.trim()) {
    input.title = normalizedValues.title;
  }

  if (normalizedValues.description !== initialValues.description) {
    input.description = normalizedValues.description;
  }

  if (normalizedValues.startsAt !== initialValues.startsAt) {
    input.startsAt = normalizedValues.startsAt;
  }

  if (normalizedValues.endsAt !== initialValues.endsAt) {
    input.endsAt = normalizedValues.endsAt;
  }

  if (Object.keys(input).length === 0) {
    return {
      errors: { form: "Altere pelo menos um campo antes de salvar." },
      input: null,
    };
  }

  return { errors, input };
};

export const AdminMeetingDialog = ({
  dialogError,
  groupName,
  initialValues,
  isSubmitting,
  mode,
  now,
  onCancel,
  onSubmit,
}: AdminMeetingDialogProps) => {
  const [values, setValues] = useState(() => toFormValues(initialValues));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSubmitting) {
        return;
      }

      event.preventDefault();
      onCancel();
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSubmitting, onCancel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const result = validateAndBuildInput(values, mode, now, initialValues);
    setFieldErrors(result.errors);

    if (!result.input) {
      return;
    }

    onSubmit(result.input);
  };

  const dialogTitle = mode === "create" ? "Novo encontro" : "Editar encontro";
  const submitLabel = mode === "create" ? "Criar encontro" : "Salvar alterações";

  return (
    <div
      aria-describedby={DESCRIPTION_ID}
      aria-labelledby={TITLE_ID}
      aria-modal="true"
      className="admin-modal-backdrop"
      role="dialog"
    >
      <Card className="admin-modal" tone="soft">
        <p className="card-eyebrow">Agenda do grupo</p>
        <h2 id={TITLE_ID}>{dialogTitle}</h2>
        <p id={DESCRIPTION_ID}>
          {mode === "create"
            ? `Crie um encontro futuro para o grupo ${groupName}.`
            : `Atualize apenas campos permitidos do encontro futuro de ${groupName}.`}
        </p>

        <form className="teacher-form-grid" onSubmit={handleSubmit}>
          <label className="field" htmlFor={TITLE_FIELD_ID}>
            <span className="field__label">Título</span>
            <input
              aria-describedby={fieldErrors.title ? `${TITLE_FIELD_ID}-error` : undefined}
              aria-invalid={fieldErrors.title ? "true" : undefined}
              className="field__control"
              disabled={isSubmitting}
              id={TITLE_FIELD_ID}
              maxLength={120}
              onChange={(event) =>
                setValues((current) => ({ ...current, title: event.target.value }))
              }
              ref={titleInputRef}
              type="text"
              value={values.title}
            />
            {fieldErrors.title ? (
              <span className="field__message field__message--error" id={`${TITLE_FIELD_ID}-error`}>
                {fieldErrors.title}
              </span>
            ) : null}
          </label>

          <label className="field" htmlFor={DESCRIPTION_FIELD_ID}>
            <span className="field__label">Descrição</span>
            <textarea
              aria-describedby={fieldErrors.description ? `${DESCRIPTION_FIELD_ID}-error` : undefined}
              aria-invalid={fieldErrors.description ? "true" : undefined}
              className="field__control"
              disabled={isSubmitting}
              id={DESCRIPTION_FIELD_ID}
              maxLength={320}
              onChange={(event) =>
                setValues((current) => ({ ...current, description: event.target.value }))
              }
              rows={4}
              value={values.description}
            />
            {fieldErrors.description ? (
              <span className="field__message field__message--error" id={`${DESCRIPTION_FIELD_ID}-error`}>
                {fieldErrors.description}
              </span>
            ) : null}
          </label>

          <label className="field" htmlFor={STARTS_AT_FIELD_ID}>
            <span className="field__label">Início</span>
            <input
              aria-describedby={fieldErrors.startsAt ? `${STARTS_AT_FIELD_ID}-error` : undefined}
              aria-invalid={fieldErrors.startsAt ? "true" : undefined}
              className="field__control"
              disabled={isSubmitting}
              id={STARTS_AT_FIELD_ID}
              onChange={(event) =>
                setValues((current) => ({ ...current, startsAt: event.target.value }))
              }
              type="datetime-local"
              value={values.startsAt}
            />
            {fieldErrors.startsAt ? (
              <span className="field__message field__message--error" id={`${STARTS_AT_FIELD_ID}-error`}>
                {fieldErrors.startsAt}
              </span>
            ) : null}
          </label>

          <label className="field" htmlFor={ENDS_AT_FIELD_ID}>
            <span className="field__label">Término</span>
            <input
              aria-describedby={fieldErrors.endsAt ? `${ENDS_AT_FIELD_ID}-error` : undefined}
              aria-invalid={fieldErrors.endsAt ? "true" : undefined}
              className="field__control"
              disabled={isSubmitting}
              id={ENDS_AT_FIELD_ID}
              onChange={(event) =>
                setValues((current) => ({ ...current, endsAt: event.target.value }))
              }
              type="datetime-local"
              value={values.endsAt}
            />
            {fieldErrors.endsAt ? (
              <span className="field__message field__message--error" id={`${ENDS_AT_FIELD_ID}-error`}>
                {fieldErrors.endsAt}
              </span>
            ) : null}
          </label>

          {fieldErrors.form ? (
            <p className="field__message field__message--error" id={FORM_ERROR_ID}>
              {fieldErrors.form}
            </p>
          ) : null}

          {dialogError ? (
            <AlertBox title="Não foi possível salvar o encontro" tone="warning">
              {dialogError}
            </AlertBox>
          ) : null}

          <div className="button-row">
            <Button
              aria-describedby={fieldErrors.form ? FORM_ERROR_ID : undefined}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Salvando..." : submitLabel}
            </Button>
            <Button disabled={isSubmitting} onClick={onCancel} variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
