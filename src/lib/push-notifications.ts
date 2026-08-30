"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sns.pushEnabled";

export function isPushEnabled(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return (
    localStorage.getItem(STORAGE_KEY) === "1" && Notification.permission === "granted"
  );
}

export function notifyBrowser(title: string, body: string) {
  if (!isPushEnabled()) return;
  if (document.visibilityState === "visible") return;
  try {
    new Notification(title, { body, icon: "/icon.svg" });
  } catch {
    // notifications can fail silently (e.g. unsupported context); nothing to recover
  }
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const ok = typeof window !== "undefined" && "Notification" in window;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
  }, []);

  async function requestPermission() {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    localStorage.setItem(STORAGE_KEY, result === "granted" ? "1" : "0");
  }

  return { supported, permission, requestPermission };
}
