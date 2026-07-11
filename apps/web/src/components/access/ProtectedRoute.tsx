import { Navigate, Outlet, useLocation } from "react-router-dom";

import { canAccessRoute } from "../../auth/roles";
import type { RouteType } from "../../auth/types";
import { useCurrentUserMock } from "../../mocks/currentUser";
import { ProfileHeader } from "../display/ProfileHeader";
import { AreaSwitcher } from "../auth/AreaSwitcher";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface ProtectedRouteProps {
  routeType: Exclude<RouteType, "public">;
  redirectTo?: string;
}

const routeLabels: Record<Exclude<RouteType, "public">, string> = {
  student: "Área do Aluno",
  teacher: "Área do Professor",
  admin: "Área Administrativa",
};

export const ProtectedRoute = ({ routeType, redirectTo }: ProtectedRouteProps) => {
  const location = useLocation();
  const user = useCurrentUserMock();

  if (canAccessRoute(user, routeType)) {
    return <Outlet />;
  }

  if (redirectTo) {
    return <Navigate replace state={{ from: location }} to={redirectTo} />;
  }

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Acesso restrito"
        description="Esta área usa um controle demonstrativo de perfis nesta fase do projeto."
        eyebrow={routeType === "admin" ? "Administração" : "Controle de acesso"}
        title="Você não tem acesso a esta área."
      />

      <Card className="access-denied-card" tone="soft">
        <h2>{routeLabels[routeType]}</h2>
        <p>
          O perfil atual não tem permissão para abrir esta área. No ambiente demonstrativo, você
          pode trocar de perfil para revisar a navegação. Em uma versão futura, isso será protegido
          por autenticação real.
        </p>
        <div className="access-denied-card__actions">
          <Button to="/portal">Voltar ao portal</Button>
          <Button to="/educacao-continuada" variant="secondary">
            Ver página pública
          </Button>
        </div>
        <AreaSwitcher />
      </Card>
    </div>
  );
};
