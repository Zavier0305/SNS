"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export const REACTION_EMOJIS = ["👍", "😂", "😮", "😢", "🎉"] as const;

export type ReactionCounts = Record<string, { count: number; reactedByMe: boolean }>;

export async function fetchReactions(
  postId: string,
  userId: string | null,
): Promise<ReactionCounts> {
  const { data } = await supabase
    .from("sns_reactions")
    .select("emoji, user_id")
    .eq("post_id", postId);

  const counts: ReactionCounts = {};
  for (const row of data ?? []) {
    if (!counts[row.emoji]) counts[row.emoji] = { count: 0, reactedByMe: false };
    counts[row.emoji].count += 1;
    if (row.user_id === userId) counts[row.emoji].reactedByMe = true;
  }
  return counts;
}

export function useReactions(postId: string, userId: string | null) {
  const [reactions, setReactions] = useState<ReactionCounts>({});

  function refresh() {
    fetchReactions(postId, userId).then(setReactions);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, userId]);

  return { reactions, refresh };
}

export async function toggleReaction(
  postId: string,
  userId: string,
  emoji: string,
  reacted: boolean,
) {
  if (reacted) {
    await supabase
      .from("sns_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
  } else {
    await supabase
      .from("sns_reactions")
      .insert({ post_id: postId, user_id: userId, emoji });
  }
}
