import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { createReturnLocation } from "../../routing/publicUrls";
import { LoadingState } from "../ui/LoadingState";

export const AuthenticatedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isDemoMode, isLoading, requiresPasswordChange } = useAuth();

  if (isLoading) {
    return <LoadingState description="Estamos verificando seu acesso local." title="Conferindo login" />;
  }

  if (!isDemoMode && !isAuthenticated) {
    return <Navigate replace state={{ from: createReturnLocation(location) }} to="/login" />;
  }

  if (!isDemoMode && requiresPasswordChange) {
    return <Navigate replace state={{ from: createReturnLocation(location) }} to="/primeiro-acesso" />;
  }

  return <Outlet />;
};
