"use client";

import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export const PROFILE_COLUMNS =
  "id, handle, display_name, created_at, theme_color, bio, cover_url, avatar_url, pinned_post_id";

export type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  theme_color: string | null;
  bio: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  pinned_post_id: string | null;
};

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
    themeColor: row.theme_color,
    bio: row.bio,
    coverUrl: row.cover_url,
    avatarUrl: row.avatar_url,
    pinnedPostId: row.pinned_post_id,
  };
}

export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  const { data } = await supabase.from("sns_profiles").select(PROFILE_COLUMNS).in("id", uniqueIds);
  return (data ?? []).map(toProfile);
}
