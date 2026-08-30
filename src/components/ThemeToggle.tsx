"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sns.theme";

function applyTheme(theme: "light" | "dark" | null) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme) root.classList.add(theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored === "light" || stored === "dark" ? stored : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentIsDark = theme === "dark" || (theme === null && prefersDark);
    const next = currentIsDark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      onClick={toggle}
      className="text-xs text-black/60 dark:text-white/60 hover:underline"
      aria-label="テーマ切り替え"
    >
      {theme === "dark" ? "☀️" : theme === "light" ? "🌙" : "🌓"}
    </button>
  );
}
