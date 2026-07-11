import type { AdminGroup, AdminGroupStatus, AdminGroupUpdateInput } from "../types/adminGroups";

const GROUPS_STORAGE_KEY = "portal-estudos-espiritas-ai:admin-groups";
const DEMO_MEET_LINK_EMMANUEL = "https://example.com/demo-meet/emmanuel-admin";
const DEMO_MEET_LINK_A_CAMINHO_DA_LUZ =
  "https://example.com/demo-meet/a-caminho-da-luz-admin";

const cloneGroup = (group: AdminGroup): AdminGroup => ({
  ...group,
});

const seededGroups: AdminGroup[] = [
  {
    id: "emmanuel",
    name: "Emmanuel",
    bookTitle: "Emmanuel",
    teacherName: "Professora Ariete",
    meetingDay: "Segunda-feira",
    meetingTime: "20h",
    status: "active",
    meetUrl: DEMO_MEET_LINK_EMMANUEL,
    demoMeetUrl: DEMO_MEET_LINK_EMMANUEL,
    welcomeMessage:
      "Olá! Você está convidado(a) para o grupo Emmanuel da Educação Continuada. Nosso encontro acontece na segunda-feira, às 20h. Entre com serenidade, leia os materiais da semana e, em caso de dúvida, conte com o professor.",
  },
  {
    id: "a-caminho-da-luz",
    name: "A Caminho da Luz",
    bookTitle: "A Caminho da Luz",
    teacherName: "Professor Luiz",
    meetingDay: "Quarta-feira",
    meetingTime: "20h",
    status: "active",
    meetUrl: DEMO_MEET_LINK_A_CAMINHO_DA_LUZ,
    demoMeetUrl: DEMO_MEET_LINK_A_CAMINHO_DA_LUZ,
    welcomeMessage:
      "Olá! Você está convidado(a) para o grupo A Caminho da Luz da Educação Continuada. Nosso encontro acontece na quarta-feira, às 20h. Leia o resumo da semana com calma e acompanhe o portal para receber as orientações da aula.",
  },
];

const isBrowser = () => {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
};

const readStoredGroups = (): AdminGroup[] | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(GROUPS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminGroup[]) : null;
  } catch (_error) {
    return null;
  }
};

const writeStoredGroups = (items: AdminGroup[]) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(items));
};

const getCurrentGroups = () => {
  const storedItems = readStoredGroups();
  return (storedItems ?? seededGroups).map(cloneGroup);
};

export const listMockAdminGroups = () => {
  return getCurrentGroups();
};

export const updateMockAdminGroup = (id: AdminGroup["id"], input: AdminGroupUpdateInput) => {
  const currentGroups = getCurrentGroups();
  const targetIndex = currentGroups.findIndex((group) => group.id === id);

  if (targetIndex === -1) {
    return null;
  }

  const updatedGroup: AdminGroup = {
    ...currentGroups[targetIndex],
    ...input,
  };

  currentGroups.splice(targetIndex, 1, updatedGroup);
  writeStoredGroups(currentGroups);

  return cloneGroup(updatedGroup);
};

export const toggleMockAdminGroupStatus = (
  id: AdminGroup["id"],
  status: AdminGroupStatus,
) => {
  const currentGroups = getCurrentGroups();
  const targetIndex = currentGroups.findIndex((group) => group.id === id);

  if (targetIndex === -1) {
    return null;
  }

  const updatedGroup: AdminGroup = {
    ...currentGroups[targetIndex],
    status,
  };

  currentGroups.splice(targetIndex, 1, updatedGroup);
  writeStoredGroups(currentGroups);

  return cloneGroup(updatedGroup);
};

export const resetMockAdminGroups = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(GROUPS_STORAGE_KEY);
};
