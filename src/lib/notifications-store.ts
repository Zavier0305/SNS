"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type NotificationType = "like" | "comment" | "follow" | "reaction";

export type Notification = {
  id: string;
  actorId: string;
  actorHandle: string;
  actorDisplayName: string;
  type: NotificationType;
  postId: string | null;
  createdAt: string;
  readAt: string | null;
};

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from("sns_notifications")
    .select("id, actor_id, type, post_id, created_at, read_at, sns_profiles(handle, display_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorHandle: row.sns_profiles?.handle ?? "",
    actorDisplayName: row.sns_profiles?.display_name ?? "名無しさん",
    type: row.type as NotificationType,
    postId: row.post_id,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function markAllNotificationsRead(userId: string) {
  await supabase
    .from("sns_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

export function useUnreadNotificationCount(userId: string | null) {
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
    const channel = supabase
      .channel(`sns_notifications_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sns_notifications", filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { count, refresh };
}
