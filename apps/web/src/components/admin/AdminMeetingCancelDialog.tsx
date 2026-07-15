import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { AdminStudyMeeting } from "../../types/adminStudyMeetings";
import { AlertBox } from "../ui/AlertBox";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface AdminMeetingCancelDialogProps {
  dialogError: string | null;
  formattedStartsAt: string;
  isSubmitting: boolean;
  meeting: AdminStudyMeeting;
  onCancel: () => void;
  onConfirm: (input: { cancellationReason: string }) => void;
}

const TITLE_ID = "admin-meeting-cancel-dialog-title";
const DESCRIPTION_ID = "admin-meeting-cancel-dialog-description";
const REASON_FIELD_ID = "admin-meeting-cancellation-reason";

export const AdminMeetingCancelDialog = ({
  dialogError,
  formattedStartsAt,
  isSubmitting,
  meeting,
  onCancel,
  onConfirm,
}: AdminMeetingCancelDialogProps) => {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    reasonRef.current?.focus();
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

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setFieldError("Informe o motivo do cancelamento.");
      return;
    }

    if (trimmedReason.length > 320) {
      setFieldError("Use no máximo 320 caracteres no motivo.");
      return;
    }

    setFieldError(null);
    onConfirm({ cancellationReason: trimmedReason });
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
        <p className="card-eyebrow">Cancelamento de encontro</p>
        <h2 id={TITLE_ID}>Cancelar encontro</h2>
        <p id={DESCRIPTION_ID}>
          O cancelamento de {meeting.title} ficará registrado no histórico do grupo.
        </p>
        <p>
          <strong>Início:</strong> {formattedStartsAt}
        </p>

        <AlertBox title="Atenção" tone="warning">
          Esta ação não exclui o encontro. Ela registra o cancelamento e preserva o histórico para
          consulta administrativa.
        </AlertBox>

        <form className="teacher-form-grid" onSubmit={handleSubmit}>
          <label className="field" htmlFor={REASON_FIELD_ID}>
            <span className="field__label">Motivo do cancelamento</span>
            <textarea
              aria-describedby={fieldError ? `${REASON_FIELD_ID}-error` : undefined}
              aria-invalid={fieldError ? "true" : undefined}
              className="field__control"
              disabled={isSubmitting}
              id={REASON_FIELD_ID}
              maxLength={320}
              onChange={(event) => setReason(event.target.value)}
              ref={reasonRef}
              rows={4}
              value={reason}
            />
            {fieldError ? (
              <span className="field__message field__message--error" id={`${REASON_FIELD_ID}-error`}>
                {fieldError}
              </span>
            ) : null}
          </label>

          {dialogError ? (
            <AlertBox title="Não foi possível cancelar o encontro" tone="warning">
              {dialogError}
            </AlertBox>
          ) : null}

          <div className="button-row">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
            <Button disabled={isSubmitting} onClick={onCancel} variant="secondary">
              Manter encontro
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
