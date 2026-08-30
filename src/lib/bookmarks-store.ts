"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchPostsByIds } from "@/lib/posts-store";
import type { Post } from "@/lib/types";

export async function fetchBookmarkedPostIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("sns_bookmarks")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => row.post_id);
}

export async function fetchBookmarkedPosts(userId: string): Promise<Post[]> {
  const ids = await fetchBookmarkedPostIds(userId);
  const posts = await fetchPostsByIds(ids, userId);
  const order = new Map(ids.map((id, i) => [id, i]));
  return posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function toggleBookmark(postId: string, userId: string, bookmarked: boolean) {
  if (bookmarked) {
    await supabase
      .from("sns_bookmarks")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  } else {
    await supabase.from("sns_bookmarks").insert({ post_id: postId, user_id: userId });
  }
}

export function useIsBookmarked(postId: string, userId: string | null) {
  const [bookmarked, setBookmarked] = useState(false);

  const refresh = useCallback(() => {
    if (!userId) {
      setBookmarked(false);
      return;
    }
    supabase
      .from("sns_bookmarks")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setBookmarked(!!data));
  }, [postId, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { bookmarked, refresh };
}
