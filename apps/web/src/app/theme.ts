export const themeOptions = [
  { value: "light", label: "Claro" },
  { value: "neutral", label: "Neutro" },
  { value: "dark", label: "Escuro" },
] as const;

export type AppTheme = (typeof themeOptions)[number]["value"];

const THEME_STORAGE_KEY = "portal-estudos-espiritas-ai:theme";

const isTheme = (value: string | null | undefined): value is AppTheme => {
  return themeOptions.some((option) => option.value === value);
};

export const readThemePreference = (): AppTheme => {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedValue) ? storedValue : "light";
  } catch (_error) {
    return "light";
  }
};

export const writeThemePreference = (theme: AppTheme) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const applyThemePreference = (theme: AppTheme) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
};
