import { Navigate, Outlet, useLocation } from "react-router-dom";

import { canAccessRoute } from "../../auth/roles";
import type { RouteType } from "../../auth/types";
import { useAuth } from "../../auth/useAuth";
import { createReturnLocation } from "../../routing/publicUrls";
import { ProfileHeader } from "../display/ProfileHeader";
import { AreaSwitcher } from "../auth/AreaSwitcher";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadingState } from "../ui/LoadingState";

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
  const { isAuthenticated, isDemoMode, isLoading, requiresPasswordChange, user } = useAuth();

  if (isLoading) {
    return <LoadingState description="Estamos verificando seu acesso local." title="Conferindo login" />;
  }

  if (canAccessRoute(user, routeType)) {
    if (!isDemoMode && requiresPasswordChange) {
      return <Navigate replace state={{ from: createReturnLocation(location) }} to="/primeiro-acesso" />;
    }

    return <Outlet />;
  }

  if (!isDemoMode && !isAuthenticated) {
    return <Navigate replace state={{ from: createReturnLocation(location) }} to={redirectTo ?? "/login"} />;
  }

  if (redirectTo && isDemoMode) {
    return <Navigate replace state={{ from: createReturnLocation(location) }} to={redirectTo} />;
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
          {isDemoMode
            ? "O perfil atual não tem permissão para abrir esta área. No ambiente demonstrativo, você pode trocar de perfil para revisar a navegação."
            : "Seu perfil autenticado não tem permissão para abrir esta área no ambiente local."}
        </p>
        <div className="access-denied-card__actions">
          <Button to="/portal">Voltar ao portal</Button>
          <Button to={isDemoMode ? "/educacao-continuada" : "/login"} variant="secondary">
            {isDemoMode ? "Ver página pública" : "Ir para o login"}
          </Button>
        </div>
        {isDemoMode ? <AreaSwitcher /> : null}
      </Card>
    </div>
  );
};
