"use client";

import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export async function searchProfiles(query: string): Promise<Profile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data } = await supabase
    .from("sns_profiles")
    .select("id, handle, display_name, created_at")
    .or(`handle.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
    .limit(20);
  return (data ?? []).map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
  }));
}

export async function fetchProfileByHandle(handle: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("sns_profiles")
    .select("id, handle, display_name, created_at")
    .eq("handle", handle)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    handle: data.handle,
    displayName: data.display_name,
    createdAt: data.created_at,
  };
}
