"use client";

import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("sns_profiles")
    .select("id, handle, display_name, created_at, theme_color")
    .in("id", ids);
  return (data ?? []).map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
    themeColor: row.theme_color,
  }));
}

export async function fetchFollowingProfiles(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from("sns_follows")
    .select("followee_id")
    .eq("follower_id", userId);
  return fetchProfilesByIds((data ?? []).map((row) => row.followee_id));
}

export async function fetchFollowerProfiles(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from("sns_follows")
    .select("follower_id")
    .eq("followee_id", userId);
  return fetchProfilesByIds((data ?? []).map((row) => row.follower_id));
}

export async function fetchFollowCounts(
  userId: string,
): Promise<{ following: number; followers: number }> {
  const [followingRes, followersRes] = await Promise.all([
    supabase
      .from("sns_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
    supabase
      .from("sns_follows")
      .select("*", { count: "exact", head: true })
      .eq("followee_id", userId),
  ]);
  return {
    following: followingRes.count ?? 0,
    followers: followersRes.count ?? 0,
  };
}
