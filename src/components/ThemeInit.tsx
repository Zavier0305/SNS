"use client";

import { useEffect } from "react";
import { applyTheme, readStoredTheme } from "@/lib/theme";

// Mounted unconditionally at the app root (unlike ThemeToggle, which only
// renders once the user opens the sidebar drawer) so the `.dark` class is
// resolved from the OS preference on first paint of every page, not only
// after the user finds the theme toggle.
export function ThemeInit() {
  useEffect(() => {
    applyTheme(readStoredTheme());
  }, []);
  return null;
}
