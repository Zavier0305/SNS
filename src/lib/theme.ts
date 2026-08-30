export const THEME_STORAGE_KEY = "sns.theme";

export type Theme = "light" | "dark";

export function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

// Tailwind's `dark:` variant only activates via the `.dark` class (see the
// `@custom-variant dark` rule in globals.css), so a system-dark visitor who
// hasn't manually chosen a theme needs that class resolved from the OS
// preference, not left unset like the background/foreground CSS variables.
export function resolveTheme(theme: Theme | null): Theme {
  if (theme) return theme;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme | null) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolveTheme(theme));
}
