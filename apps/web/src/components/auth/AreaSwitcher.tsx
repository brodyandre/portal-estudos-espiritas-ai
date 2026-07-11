import { cn } from "../../app/cn";
import type { UserRole } from "../../auth/types";
import {
  canSwitchMockUser,
  getAvailableMockUsers,
  setCurrentUserRole,
  useCurrentUserMock,
} from "../../mocks/currentUser";

const roleLabels: Record<UserRole, string> = {
  visitor: "Público",
  student: "Aluno",
  teacher: "Professor",
  admin: "Admin",
};

export const AreaSwitcher = () => {
  const currentUser = useCurrentUserMock();

  if (!canSwitchMockUser) {
    return null;
  }

  return (
    <div className="area-switcher" role="group" aria-label="Alternar perfil demonstrativo">
      <span className="area-switcher__label">Perfil demo</span>
      <div className="area-switcher__options">
        {getAvailableMockUsers().map((user) => {
          const isActive = user.role === currentUser.role;

          return (
            <button
              aria-pressed={isActive}
              className={cn("area-switcher__button", isActive && "area-switcher__button--active")}
              key={user.role}
              onClick={() => setCurrentUserRole(user.role)}
              type="button"
            >
              {roleLabels[user.role]}
            </button>
          );
        })}
      </div>
    </div>
  );
};
