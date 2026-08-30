"use client";

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
    .select(
      "id, actor_id, type, post_id, created_at, read_at, sns_profiles!sns_notifications_actor_id_fkey(handle, display_name)",
    )
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

export async function markNotificationRead(notificationId: string) {
  await supabase
    .from("sns_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
}
