import type {
  AdminUserActivationStatus,
  AdminUserListItem,
  AdminUserListParams,
  AdminUsersListResult,
} from "../types/adminUsersList";

const DEMO_USERS: AdminUserListItem[] = [
  {
    id: "demo-admin-user-001",
    name: "Ana Beatriz Moraes",
    emailMasked: "an***@demo.local",
    role: "student",
    status: "active",
    activationStatus: "activated",
    group: { name: "Emmanuel", slug: "emmanuel" },
    createdAt: "2026-07-03T19:20:00.000Z",
  },
  {
    id: "demo-admin-user-002",
    name: "Bruno Lima",
    emailMasked: "br***@demo.local",
    role: "teacher",
    status: "active",
    activationStatus: "activated",
    group: { name: "A Caminho da Luz", slug: "a-caminho-da-luz" },
    createdAt: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "demo-admin-user-003",
    name: "Celia Nogueira",
    emailMasked: "ce***@demo.local",
    role: "teacher",
    status: "inactive",
    activationStatus: "activated",
    group: { name: "Emmanuel", slug: "emmanuel" },
    createdAt: "2026-06-28T12:30:00.000Z",
  },
  {
    id: "demo-admin-user-004",
    name: "Diego Farias",
    emailMasked: "di***@demo.local",
    role: "visitor",
    status: "pending",
    activationStatus: "not_activated",
    group: null,
    createdAt: "2026-07-14T08:00:00.000Z",
  },
  {
    id: "demo-admin-user-005",
    name: "Ester Prado",
    emailMasked: "es***@demo.local",
    role: "admin",
    status: "active",
    activationStatus: "activated",
    group: null,
    createdAt: "2026-07-11T14:15:00.000Z",
  },
  {
    id: "demo-admin-user-006",
    name: "Felipe Rocha",
    emailMasked: "fe***@demo.local",
    role: "student",
    status: "rejected",
    activationStatus: "not_activated",
    group: null,
    createdAt: "2026-06-19T11:00:00.000Z",
  },
  {
    id: "demo-admin-user-007",
    name: "Gabriela Souza",
    emailMasked: "ga***@demo.local",
    role: "student",
    status: "pending",
    activationStatus: "not_activated",
    group: { name: "Emmanuel", slug: "emmanuel" },
    createdAt: "2026-07-10T10:20:00.000Z",
  },
  {
    id: "demo-admin-user-008",
    name: "Helena Costa",
    emailMasked: "he***@demo.local",
    role: "student",
    status: "inactive",
    activationStatus: "activated",
    group: { name: "A Caminho da Luz", slug: "a-caminho-da-luz" },
    createdAt: "2026-07-01T17:45:00.000Z",
  },
  {
    id: "demo-admin-user-009",
    name: "Igor Campos",
    emailMasked: "ig***@demo.local",
    role: "teacher",
    status: "active",
    activationStatus: "not_activated",
    group: null,
    createdAt: "2026-07-05T13:10:00.000Z",
  },
  {
    id: "demo-admin-user-010",
    name: "Juliana Pires",
    emailMasked: "ju***@demo.local",
    role: "student",
    status: "active",
    activationStatus: "activated",
    group: { name: "Emmanuel", slug: "emmanuel" },
    createdAt: "2026-07-08T09:40:00.000Z",
  },
  {
    id: "demo-admin-user-011",
    name: "Karen Duarte",
    emailMasked: "ka***@demo.local",
    role: "visitor",
    status: "inactive",
    activationStatus: "not_activated",
    group: null,
    createdAt: "2026-06-23T15:55:00.000Z",
  },
  {
    id: "demo-admin-user-012",
    name: "Luciana Ferraz",
    emailMasked: "lu***@demo.local",
    role: "admin",
    status: "active",
    activationStatus: "activated",
    group: null,
    createdAt: "2026-07-09T16:35:00.000Z",
  },
];

const ROLE_ORDER = {
  visitor: 0,
  student: 1,
  teacher: 2,
  admin: 3,
} as const;

const STATUS_ORDER = {
  pending: 0,
  active: 1,
  inactive: 2,
  rejected: 3,
} as const;

const toTimestamp = (value: string) => new Date(value).getTime();

const compareText = (left: string, right: string) => {
  return left.localeCompare(right, "pt-BR", { sensitivity: "base" });
};

const compareActivationStatus = (
  left: AdminUserActivationStatus,
  right: AdminUserActivationStatus,
) => {
  return left === right ? 0 : left === "activated" ? -1 : 1;
};

const compareUsers = (
  left: AdminUserListItem,
  right: AdminUserListItem,
  field: NonNullable<AdminUserListParams["sortBy"]>,
) => {
  switch (field) {
    case "name":
      return compareText(left.name, right.name);
    case "role":
      return ROLE_ORDER[left.role] - ROLE_ORDER[right.role] || compareText(left.name, right.name);
    case "status":
      return (
        STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
        compareActivationStatus(left.activationStatus, right.activationStatus) ||
        compareText(left.name, right.name)
      );
    case "createdAt":
    default:
      return toTimestamp(left.createdAt) - toTimestamp(right.createdAt) || compareText(left.name, right.name);
  }
};

export const listMockAdminUsersList = (
  params: AdminUserListParams = {},
): AdminUsersListResult => {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const search = params.search?.trim().toLowerCase();
  const group = params.group?.trim().toLowerCase();
  const sortBy = params.sortBy ?? "createdAt";
  const sortOrder = params.sortOrder ?? "desc";

  const filtered = DEMO_USERS.filter((user) => {
    if (params.role && user.role !== params.role) {
      return false;
    }

    if (params.status && user.status !== params.status) {
      return false;
    }

    if (params.activationStatus && user.activationStatus !== params.activationStatus) {
      return false;
    }

    if (group && user.group?.slug.toLowerCase() !== group) {
      return false;
    }

    if (search) {
      const haystacks = [user.name, user.emailMasked].map((value) => value.toLowerCase());
      if (!haystacks.some((value) => value.includes(search))) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const comparison = compareUsers(left, right, sortBy);
    return sortOrder === "asc" ? comparison : comparison * -1;
  });

  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
    source: "demo",
  };
};
