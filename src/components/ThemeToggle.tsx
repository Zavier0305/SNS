"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";

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

  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === null && prefersDark);

  return (
    <button
      onClick={toggle}
      aria-label="テーマ切り替え"
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[15px] text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
    >
      {isDark ? <MoonIcon className="h-5 w-5 shrink-0" /> : <SunIcon className="h-5 w-5 shrink-0" />}
      <span>{isDark ? "ダーク" : "ライト"}</span>
    </button>
  );
}
