"use client";

import { supabase } from "@/lib/supabase/client";
import type { NotificationPrefs, Profile } from "@/lib/types";

const PROFILE_COLUMNS = "id, handle, display_name, created_at, theme_color";

function toProfile(row: {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  theme_color: string | null;
}): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
    themeColor: row.theme_color,
  };
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data } = await supabase
    .from("sns_profiles")
    .select(PROFILE_COLUMNS)
    .or(`handle.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
    .limit(20);
  return (data ?? []).map(toProfile);
}

export async function fetchProfileByHandle(handle: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("sns_profiles")
    .select(PROFILE_COLUMNS)
    .eq("handle", handle)
    .single();
  return data ? toProfile(data) : null;
}

export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await supabase
    .from("sns_profiles")
    .select("notify_likes, notify_comments, notify_follows")
    .eq("id", userId)
    .single();
  return {
    notifyLikes: data?.notify_likes ?? true,
    notifyComments: data?.notify_comments ?? true,
    notifyFollows: data?.notify_follows ?? true,
  };
}
