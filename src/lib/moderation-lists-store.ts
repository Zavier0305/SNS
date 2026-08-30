"use client";

import { supabase } from "@/lib/supabase/client";
import { fetchProfilesByIds } from "@/lib/profile-mapper";
import type { Profile } from "@/lib/types";

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
