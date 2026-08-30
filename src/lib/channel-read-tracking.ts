"use client";

const STORAGE_KEY = "sns.channelLastRead";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function markChannelRead(channelId: string) {
  const map = readMap();
  map[channelId] = new Date().toISOString();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function isChannelUnread(channelId: string, lastPostAt: string | null): boolean {
  if (!lastPostAt) return false;
  const lastRead = readMap()[channelId];
  if (!lastRead) return true;
  return new Date(lastPostAt).getTime() > new Date(lastRead).getTime();
}
