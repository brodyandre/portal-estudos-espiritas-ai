import { useContext } from "react";

import { AuthContext } from "./AuthProvider";

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return value;
};
