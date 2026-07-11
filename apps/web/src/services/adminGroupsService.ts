import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import { loadWithFallback } from "./api";
import {
  listMockAdminGroups,
  toggleMockAdminGroupStatus,
  updateMockAdminGroup,
} from "../mocks/adminGroups";
import type { AdminGroup, AdminGroupStatus, AdminGroupUpdateInput } from "../types/adminGroups";

interface ApiAdminGroup {
  id: AdminGroup["id"];
  name: string;
  bookTitle: string;
  teacherName: string;
  meetingDay: string;
  meetingTime: string;
  status: AdminGroupStatus;
  meetUrl: string;
  demoMeetUrl?: string;
  welcomeMessage: string;
}

const FALLBACK_NOTICE =
  "Modo demonstrativo: para gestão real de grupos e links, use backend autenticado no ambiente local.";

const mapAdminGroup = (item: ApiAdminGroup): AdminGroup => {
  return {
    id: item.id,
    name: item.name,
    bookTitle: item.bookTitle,
    teacherName: item.teacherName,
    meetingDay: item.meetingDay,
    meetingTime: item.meetingTime,
    status: item.status,
    meetUrl: item.meetUrl,
    demoMeetUrl: item.demoMeetUrl ?? item.meetUrl,
    welcomeMessage: item.welcomeMessage,
  };
};

export const listAdminGroups = () => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: listMockAdminGroups(),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiAdminGroup[], AdminGroup[]>({
    path: "/api/admin/groups",
    fallback: () => listMockAdminGroups(),
    mapData: (items) => items.map(mapAdminGroup),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const updateAdminGroup = (id: AdminGroup["id"], input: AdminGroupUpdateInput) => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: updateMockAdminGroup(id, input),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiAdminGroup, AdminGroup | null>({
    path: `/api/admin/groups/${id}`,
    init: {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    fallback: () => updateMockAdminGroup(id, input),
    mapData: mapAdminGroup,
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const toggleAdminGroupStatus = (id: AdminGroup["id"], status: AdminGroupStatus) => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: toggleMockAdminGroupStatus(id, status),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiAdminGroup, AdminGroup | null>({
    path: `/api/admin/groups/${id}/status`,
    init: {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
    fallback: () => toggleMockAdminGroupStatus(id, status),
    mapData: mapAdminGroup,
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const getAdminGroupMeetPreview = (group: AdminGroup) => {
  return appConfig.canShowRealMeetLink ? group.meetUrl : group.demoMeetUrl;
};

export const getAdminGroupMeetVisibilityLabel = () => {
  return appConfig.canShowRealMeetLink ? "Link real visível no ambiente local." : "Link demonstrativo nesta versão pública.";
};
