import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { LoadingState } from "../ui/LoadingState";

export const AuthenticatedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isDemoMode, isLoading, requiresPasswordChange } = useAuth();

  if (isLoading) {
    return <LoadingState description="Estamos verificando seu acesso local." title="Conferindo login" />;
  }

  if (!isDemoMode && !isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (!isDemoMode && requiresPasswordChange) {
    return <Navigate replace state={{ from: location }} to="/primeiro-acesso" />;
  }

  return <Outlet />;
};
