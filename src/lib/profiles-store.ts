"use client";

import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

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
