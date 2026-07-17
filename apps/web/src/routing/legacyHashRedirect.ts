import { isSafeInternalPath, normalizeBasePath } from "./publicUrls";

interface BrowserLocationLike {
  hash: string;
}

interface BrowserHistoryLike {
  replaceState: (data: unknown, unused: string, url?: string | URL | null) => void;
}

const normalizeLegacyRoute = (hash: string) => {
  if (!hash.startsWith("#/")) {
    return null;
  }

  const route = hash.slice(1);

  if (!isSafeInternalPath(route)) {
    return null;
  }

  return route;
};

export const buildLegacyHashRedirectPath = (hash: string, baseUrl: string | undefined) => {
  const route = normalizeLegacyRoute(hash);

  if (!route) {
    return null;
  }

  const basePath = normalizeBasePath(baseUrl);

  if (basePath === "/") {
    return route;
  }

  return `${basePath}${route}`;
};

export const redirectLegacyHashRoute = (
  locationLike: BrowserLocationLike,
  historyLike: BrowserHistoryLike,
  baseUrl: string | undefined,
) => {
  const nextPath = buildLegacyHashRedirectPath(locationLike.hash, baseUrl);

  if (!nextPath) {
    return false;
  }

  historyLike.replaceState(null, "", nextPath);
  return true;
};
