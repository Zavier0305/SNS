"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPostsByIds } from "@/lib/posts-store";
import type { Post } from "@/lib/types";

const PAGE_SIZE = 100;

export async function fetchPostsByTag(
  tag: string,
  viewerId: string | null,
): Promise<Post[]> {
  const { data } = await supabase
    .from("sns_post_hashtags")
    .select("post_id")
    .eq("tag", tag.toLowerCase())
    .limit(PAGE_SIZE);
  const postIds = (data ?? []).map((row) => row.post_id);
  return fetchPostsByIds(postIds, viewerId);
}

export async function searchPosts(
  query: string,
  viewerId: string | null,
): Promise<Post[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data } = await supabase
    .from("sns_feed")
    .select("id")
    .eq("is_hidden", false)
    .ilike("content", `%${trimmed}%`)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  const postIds = (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => !!id);
  return fetchPostsByIds(postIds, viewerId);
}

export async function fetchPreservedPosts(viewerId: string | null): Promise<Post[]> {
  const { data } = await supabase
    .from("sns_feed")
    .select("id")
    .eq("is_preserved", true)
    .is("channel_id", null)
    .order("created_at", { ascending: false })
    .limit(30);
  const postIds = (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => !!id);
  return fetchPostsByIds(postIds, viewerId);
}

export function useTrendingTags() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  const refresh = useCallback(() => {
    supabase
      .from("sns_trending_tags")
      .select("*")
      .then(({ data }) => {
        setTags(
          (data ?? [])
            .filter((row): row is { tag: string; post_count: number } => !!row.tag)
            .map((row) => ({ tag: row.tag, count: row.post_count })),
        );
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tags, refresh };
}
