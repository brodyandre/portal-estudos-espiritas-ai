const DEFAULT_ORIGIN = "https://portal-educacao-continuada.com.br";

export const normalizeBasePath = (baseUrl: string | undefined) => {
  const trimmedBaseUrl = (baseUrl ?? "/").trim();

  if (!trimmedBaseUrl || trimmedBaseUrl === "/") {
    return "/";
  }

  const withLeadingSlash = trimmedBaseUrl.startsWith("/") ? trimmedBaseUrl : `/${trimmedBaseUrl}`;
  return withLeadingSlash.replace(/\/+$/u, "") || "/";
};

export const normalizeBrowserBasename = (baseUrl: string | undefined) => {
  return normalizeBasePath(baseUrl);
};

export const isSafeInternalPath = (path: string) => {
  return path.startsWith("/") && !path.startsWith("//") && !/^[a-z][a-z0-9+.-]*:/iu.test(path);
};

const normalizeSearch = (search: string | undefined) => {
  if (!search) {
    return "";
  }

  return search.startsWith("?") ? search : `?${search}`;
};

export const buildPublicRouteUrl = (
  path: string,
  locationLike?: Pick<Location, "origin">,
  baseUrl = import.meta.env.BASE_URL,
) => {
  if (!isSafeInternalPath(path)) {
    throw new Error("A URL pública deve usar um caminho interno absoluto.");
  }

  const origin = locationLike?.origin || DEFAULT_ORIGIN;
  const basePath = normalizeBasePath(baseUrl);
  const normalizedPath = path === "/" ? "/" : path.replace(/\/+$/u, "");
  const routePath = normalizedPath === "/" ? "" : normalizedPath;
  const prefix = basePath === "/" ? "" : basePath;

  return `${origin}${prefix}${routePath || "/"}`;
};

export const createReturnLocation = (location: Pick<Location, "pathname" | "search">) => {
  return {
    pathname: location.pathname,
    search: location.search,
  };
};

export const resolveSafeRedirectTarget = (
  state: unknown,
  fallbackPath: string,
) => {
  const fallback = isSafeInternalPath(fallbackPath) ? fallbackPath : "/";

  if (!state || typeof state !== "object" || !("from" in state)) {
    return fallback;
  }

  const from = (state as { from?: unknown }).from;

  if (!from || typeof from !== "object" || !("pathname" in from)) {
    return fallback;
  }

  const pathname = (from as { pathname?: unknown }).pathname;
  const search = (from as { search?: unknown }).search;

  if (typeof pathname !== "string" || !isSafeInternalPath(pathname)) {
    return fallback;
  }

  return `${pathname}${typeof search === "string" ? normalizeSearch(search) : ""}`;
};
