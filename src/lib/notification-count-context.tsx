"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { notifyBrowser } from "@/lib/push-notifications";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type { NotificationType } from "@/lib/notifications-store";

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  like: "いいねされました",
  comment: "コメントされました",
  follow: "フォローされました",
  reaction: "リアクションされました",
};

type NotificationCountContextValue = {
  count: number;
  refresh: () => void;
};

const NotificationCountContext = createContext<NotificationCountContextValue | null>(null);

export function NotificationCountProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const { showToast } = useToast();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    supabase
      .from("sns_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    if (!userId) return;
    // This provider is mounted once at the layout level, so it is the single
    // owner of the sns_notifications realtime subscription for the current
    // user. supabase-js dedupes channels by topic and throws if a second
    // consumer tries to bind postgres_changes after the first has already
    // subscribed, so nothing else should open a channel on this topic.
    const channel = supabase
      .channel(`sns_notifications_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sns_notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          refresh();
          const type = payload.new.type as NotificationType;
          const label = NOTIFICATION_LABELS[type] ?? "新しい通知があります";
          notifyBrowser("SNS", label);
          showToast(label);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refresh]);

  return (
    <NotificationCountContext.Provider value={{ count, refresh }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount() {
  const ctx = useContext(NotificationCountContext);
  if (!ctx) throw new Error("useNotificationCount must be used within NotificationCountProvider");
  return ctx;
}
