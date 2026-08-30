"use client";

import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("sns_profiles")
    .select(
      "id, handle, display_name, created_at, theme_color, bio, cover_url, avatar_url, pinned_post_id",
    )
    .in("id", ids);
  return (data ?? []).map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
    themeColor: row.theme_color,
    bio: row.bio,
    coverUrl: row.cover_url,
    avatarUrl: row.avatar_url,
    pinnedPostId: row.pinned_post_id,
  }));
}

export async function fetchMutedProfiles(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from("sns_mutes")
    .select("muted_user_id")
    .eq("user_id", userId);
  return fetchProfilesByIds((data ?? []).map((row) => row.muted_user_id));
}

export async function fetchBlockedProfiles(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from("sns_blocks")
    .select("blocked_user_id")
    .eq("user_id", userId);
  return fetchProfilesByIds((data ?? []).map((row) => row.blocked_user_id));
}

// sns_blocks RLS only lets the blocker read their own rows, so the blocked
// side can't just query the table - this goes through a SECURITY DEFINER RPC
// that only ever returns a boolean, never the blocker's full block list.
export async function isBlockedBy(targetUserId: string): Promise<boolean> {
  const { data } = await supabase.rpc("sns_is_blocked_by", { p_user_id: targetUserId });
  return data ?? false;
}
