import type {
  AdminAuditLogEntry,
  AdminManagedRole,
  AdminManagedUser,
  AdminUserActionInput,
} from "../types/adminUsers";

const USERS_STORAGE_KEY = "portal-estudos-espiritas-ai:admin-users";
const AUDIT_STORAGE_KEY = "portal-estudos-espiritas-ai:admin-audit-log";

const cloneUser = (user: AdminManagedUser): AdminManagedUser => ({
  ...user,
});

const cloneAuditEntry = (entry: AdminAuditLogEntry): AdminAuditLogEntry => ({
  ...entry,
});

const seededUsers: AdminManagedUser[] = [
  {
    id: "admin-user-001",
    fullName: "Ana Beatriz Moraes",
    email: "ana.beatriz.demo@example.com",
    role: "student",
    status: "active",
    groupName: "Emmanuel",
    groupSlug: "emmanuel",
    createdAt: "2026-07-03T19:20:00-03:00",
    adminNote: "Participa com regularidade e acompanha os materiais pelo portal.",
  },
  {
    id: "admin-user-002",
    fullName: "Rafael Torres",
    email: "rafael.torres.demo@example.com",
    role: "student",
    status: "inactive",
    groupName: "A Caminho da Luz",
    groupSlug: "a-caminho-da-luz",
    createdAt: "2026-07-01T15:05:00-03:00",
    adminNote: "Pausou temporariamente a participação por agenda pessoal.",
  },
  {
    id: "admin-user-003",
    fullName: "Celia Nogueira",
    email: "celia.nogueira.demo@example.com",
    role: "teacher",
    status: "active",
    groupName: "Emmanuel",
    groupSlug: "emmanuel",
    createdAt: "2026-06-28T09:45:00-03:00",
    adminNote: "Responsável pela revisão de conteúdos do grupo Emmanuel.",
  },
  {
    id: "admin-user-004",
    fullName: "Marcos Vinicius Prado",
    email: "marcos.prado.demo@example.com",
    role: "admin",
    status: "active",
    groupName: "Equipe administrativa",
    groupSlug: null,
    createdAt: "2026-06-20T08:30:00-03:00",
    adminNote: "Acompanha configuração, grupos e auditoria local.",
  },
  {
    id: "admin-user-005",
    fullName: "Luciana Ferraz",
    email: "luciana.ferraz.demo@example.com",
    role: "student",
    status: "pending",
    groupName: "Sem grupo definido",
    groupSlug: null,
    createdAt: "2026-07-09T11:10:00-03:00",
    adminNote: "Cadastro em análise para vínculo com um grupo.",
  },
  {
    id: "admin-user-006",
    fullName: "Paulo Mendes",
    email: "paulo.mendes.demo@example.com",
    role: "teacher",
    status: "rejected",
    groupName: "Sem grupo definido",
    groupSlug: null,
    createdAt: "2026-06-26T13:25:00-03:00",
    adminNote: "Perfil mantido apenas para histórico demonstrativo.",
  },
];

const seededAuditEntries: AdminAuditLogEntry[] = [
  {
    id: "admin-audit-001",
    userId: "admin-user-005",
    userName: "Luciana Ferraz",
    actionType: "link_group",
    summary: "Vinculou Luciana Ferraz ao grupo Sem grupo definido para revisão posterior.",
    createdAt: "2026-07-09T11:15:00-03:00",
    actorName: "Admin demonstrativo",
  },
];

const isBrowser = () => {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
};

const readStoredUsers = (): AdminManagedUser[] | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(USERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminManagedUser[]) : null;
  } catch (_error) {
    return null;
  }
};

const readStoredAuditEntries = (): AdminAuditLogEntry[] | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminAuditLogEntry[]) : null;
  } catch (_error) {
    return null;
  }
};

const writeStoredUsers = (items: AdminManagedUser[]) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(items));
};

const writeStoredAuditEntries = (items: AdminAuditLogEntry[]) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(items));
};

const getCurrentUsers = () => {
  const storedItems = readStoredUsers();
  return (storedItems ?? seededUsers).map(cloneUser);
};

const getCurrentAuditEntries = () => {
  const storedItems = readStoredAuditEntries();
  return (storedItems ?? seededAuditEntries).map(cloneAuditEntry);
};

const roleLabel: Record<AdminManagedRole, string> = {
  student: "aluno",
  teacher: "professor",
  admin: "admin",
};

const buildAuditSummary = (user: AdminManagedUser, input: AdminUserActionInput) => {
  if (input.type === "activate") {
    return `Ativou o usuário ${user.fullName}.`;
  }

  if (input.type === "deactivate") {
    return `Inativou o usuário ${user.fullName}.`;
  }

  if (input.type === "change_role") {
    return `Alterou o perfil de ${user.fullName} para ${roleLabel[input.role]}.`;
  }

  if (input.type === "link_group") {
    return `Vinculou ${user.fullName} ao grupo ${input.groupName}.`;
  }

  return `Adicionou observação administrativa para ${user.fullName}.`;
};

const applyAction = (user: AdminManagedUser, input: AdminUserActionInput): AdminManagedUser => {
  if (input.type === "activate") {
    return {
      ...user,
      status: "active",
    };
  }

  if (input.type === "deactivate") {
    return {
      ...user,
      status: "inactive",
    };
  }

  if (input.type === "change_role") {
    return {
      ...user,
      role: input.role,
    };
  }

  if (input.type === "link_group") {
    return {
      ...user,
      groupName: input.groupName,
      groupSlug: input.groupSlug,
    };
  }

  return {
    ...user,
    adminNote: input.note.trim(),
  };
};

export const listMockAdminUsers = (filters?: {
  role?: AdminManagedRole;
  status?: AdminManagedUser["status"];
}) => {
  return getCurrentUsers().filter((user) => {
    if (filters?.role && user.role !== filters.role) {
      return false;
    }

    if (filters?.status && user.status !== filters.status) {
      return false;
    }

    return true;
  });
};

export const listMockAdminAuditEntries = (limit = 6) => {
  return getCurrentAuditEntries().slice(0, limit);
};

export const runMockAdminUserAction = (id: string, input: AdminUserActionInput) => {
  const currentUsers = getCurrentUsers();
  const targetIndex = currentUsers.findIndex((user) => user.id === id);

  if (targetIndex === -1) {
    return { user: null, auditEntry: null };
  }

  const updatedUser = applyAction(currentUsers[targetIndex], input);
  currentUsers.splice(targetIndex, 1, updatedUser);
  writeStoredUsers(currentUsers);

  const currentAuditEntries = getCurrentAuditEntries();
  const auditEntry: AdminAuditLogEntry = {
    id: `admin-audit-${Date.now()}`,
    userId: updatedUser.id,
    userName: updatedUser.fullName,
    actionType: input.type,
    summary: buildAuditSummary(updatedUser, input),
    createdAt: new Date().toISOString(),
    actorName: "Admin demonstrativo",
  };

  writeStoredAuditEntries([auditEntry, ...currentAuditEntries]);

  return {
    user: cloneUser(updatedUser),
    auditEntry: cloneAuditEntry(auditEntry),
  };
};

export const resetMockAdminUsers = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(USERS_STORAGE_KEY);
  window.sessionStorage.removeItem(AUDIT_STORAGE_KEY);
};
