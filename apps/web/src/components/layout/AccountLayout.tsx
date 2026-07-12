import { useAuth } from "../../auth/useAuth";
import { AppLayout } from "./AppLayout";

export const AccountLayout = () => {
  const { user } = useAuth();

  const area =
    user?.role === "admin"
      ? "admin"
      : user?.role === "teacher"
        ? "teacher"
        : user?.role === "student"
          ? "student"
          : "public";

  return <AppLayout area={area} />;
};
