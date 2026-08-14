import type { HTMLAttributes } from "react";

import { cn } from "../../app/cn";

const statusLabels = {
  upcoming: "Proxima aula",
  active: "Em andamento",
  inactive: "Inativo",
  draft: "Rascunho",
  pending: "Pendente",
  sent: "Enviado",
  published: "Publicado",
  attention: "Requer revisao",
  answered: "Respondida",
  canceled: "Cancelado",
  closed: "Encerrado",
  failed: "Falha",
  error: "Erro",
  success: "Sucesso",
  info: "Info",
  notConfigured: "Nao configurado",
  not_configured: "Nao configurado",
  scheduled: "Agendado",
} as const;

export type StatusTagTone = keyof typeof statusLabels;

interface StatusTagProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTagTone;
  label?: string;
}

export const StatusTag = ({ tone, label, className, ...rest }: StatusTagProps) => {
  return (
    <span className={cn("status-tag", `status-tag--${tone}`, className)} {...rest}>
      {label ?? statusLabels[tone]}
    </span>
  );
};
