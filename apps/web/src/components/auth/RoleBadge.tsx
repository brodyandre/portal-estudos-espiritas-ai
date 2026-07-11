import type { AppUser } from "../../auth/types";
import { Badge } from "../ui/Badge";

interface RoleBadgeProps {
  user: AppUser;
}

const roleLabels: Record<AppUser["role"], string> = {
  visitor: "Público",
  student: "Aluno",
  teacher: "Professor",
  admin: "Admin",
};

const statusLabels: Record<AppUser["status"], string> = {
  pending: "Aguardando",
  active: "Ativo",
  inactive: "Inativo",
  rejected: "Recusado",
};

export const RoleBadge = ({ user }: RoleBadgeProps) => {
  return (
    <div className="role-badge" aria-label={`Perfil atual: ${roleLabels[user.role]}`}>
      <Badge tone={user.role === "admin" ? "brand" : "sand"}>{roleLabels[user.role]}</Badge>
      <span className="role-badge__status">{statusLabels[user.status]}</span>
    </div>
  );
};
