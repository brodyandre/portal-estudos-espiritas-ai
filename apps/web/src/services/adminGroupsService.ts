import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import { loadWithFallback, requestJson, ServiceRequestError } from "./api";
import {
  listMockAdminGroups,
  toggleMockAdminGroupStatus,
  updateMockAdminGroup,
} from "../mocks/adminGroups";
import type {
  AdminGroup,
  AdminGroupsListStatus,
  AdminGroupStatus,
  AdminGroupUpdateInput,
  AdminSelectableGroup,
  AdminSelectableGroupsResult,
} from "../types/adminGroups";

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

interface ApiAdminSelectableGroupsData {
  items: unknown;
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

const invalidSelectableGroupsEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para grupos administrativos.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

const isAdminGroupStatus = (value: unknown): value is AdminGroupStatus => {
  return value === "active" || value === "inactive";
};

const mapSelectableGroup = (value: unknown): AdminSelectableGroup => {
  if (!isRecord(value)) {
    throw invalidSelectableGroupsEnvelopeError();
  }

  const { name, slug, status } = value;

  if (!isNonEmptyString(name) || !isNonEmptyString(slug) || !isAdminGroupStatus(status)) {
    throw invalidSelectableGroupsEnvelopeError();
  }

  return {
    name,
    slug,
    status,
  };
};

const mapMockSelectableGroups = (status: AdminGroupsListStatus): AdminSelectableGroup[] => {
  const groups = listMockAdminGroups()
    .filter((group) => status === "all" || group.status === status)
    .sort((first, second) => {
      const nameComparison = first.name.localeCompare(second.name, "pt-BR", {
        sensitivity: "base",
      });

      if (nameComparison !== 0) {
        return nameComparison;
      }

      return first.id.localeCompare(second.id);
    });

  return groups.map((group) => ({
    name: group.name,
    slug: group.id,
    status: group.status,
  }));
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

export const listAdminSelectableGroups = async (
  status: AdminGroupsListStatus = "active",
): Promise<AdminSelectableGroupsResult> => {
  if (appConfig.appMode === "demo" || appConfig.isGithubPages || !appConfig.canUseAdminFeatures) {
    return {
      items: mapMockSelectableGroups(status),
      source: "demo",
    };
  }

  const payload = await requestJson<ApiAdminSelectableGroupsData>({
    path: "/api/admin/groups",
    query: {
      status,
    },
  });

  if (!payload.data || !Array.isArray(payload.data.items)) {
    throw invalidSelectableGroupsEnvelopeError();
  }

  return {
    items: payload.data.items.map(mapSelectableGroup),
    source: "api",
  };
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
