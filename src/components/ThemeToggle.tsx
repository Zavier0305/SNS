"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";
import { applyTheme, readStoredTheme, resolveTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = resolveTheme(theme) === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  const isDark = resolveTheme(theme) === "dark";

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
