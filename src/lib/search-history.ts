"use client";

const STORAGE_KEY = "sns.searchHistory";
const MAX_HISTORY = 8;

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") return getSearchHistory();
  const next = [trimmed, ...getSearchHistory().filter((q) => q !== trimmed)].slice(0, MAX_HISTORY);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function removeSearchHistoryItem(query: string): string[] {
  const next = getSearchHistory().filter((q) => q !== query);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearSearchHistory(): string[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return [];
}
