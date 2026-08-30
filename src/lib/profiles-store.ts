"use client";

import { POST_IMAGE_BUCKET, supabase } from "@/lib/supabase/client";
import type { NotificationPrefs, Profile } from "@/lib/types";

export const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadCoverImage(userId: string, file: File): Promise<string> {
  if (file.size > MAX_COVER_IMAGE_BYTES) {
    throw new Error("画像は5MB以下にしてください");
  }
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `covers/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(POST_IMAGE_BUCKET).upload(path, file);
  if (error) throw error;
  return supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

const PROFILE_COLUMNS = "id, handle, display_name, created_at, theme_color, bio, cover_url";

function toProfile(row: {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  theme_color: string | null;
  bio: string | null;
  cover_url: string | null;
}): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
    themeColor: row.theme_color,
    bio: row.bio,
    coverUrl: row.cover_url,
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
