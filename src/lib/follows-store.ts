"use client";

import { supabase } from "@/lib/supabase/client";
import { PROFILE_COLUMNS, toProfile, fetchProfilesByIds } from "@/lib/profile-mapper";
import type { Profile } from "@/lib/types";

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

export async function fetchSuggestedProfiles(userId: string, limit = 5): Promise<Profile[]> {
  const [followingRes, blockedRes, mutedRes] = await Promise.all([
    supabase.from("sns_follows").select("followee_id").eq("follower_id", userId),
    supabase.from("sns_blocks").select("blocked_user_id").eq("user_id", userId),
    supabase.from("sns_mutes").select("muted_user_id").eq("user_id", userId),
  ]);
  const excluded = new Set<string>([
    userId,
    ...(followingRes.data ?? []).map((r) => r.followee_id),
    ...(blockedRes.data ?? []).map((r) => r.blocked_user_id),
    ...(mutedRes.data ?? []).map((r) => r.muted_user_id),
  ]);
  const { data } = await supabase
    .from("sns_profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit + excluded.size);
  return (data ?? [])
    .filter((row) => !excluded.has(row.id))
    .slice(0, limit)
    .map(toProfile);
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
