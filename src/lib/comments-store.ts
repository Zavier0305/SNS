"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Comment } from "@/lib/types";

async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("sns_comments")
    .select("id, post_id, author_id, content, created_at, sns_profiles(handle, display_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorHandle: row.sns_profiles?.handle ?? "",
    authorDisplayName: row.sns_profiles?.display_name ?? "名無しさん",
    content: row.content,
    createdAt: row.created_at,
  }));
}

export function useComments(postId: string, enabled: boolean) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    fetchComments(postId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [postId, enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { comments, loading, refresh };
}

export async function addComment(postId: string, authorId: string, content: string) {
  const { error } = await supabase
    .from("sns_comments")
    .insert({ post_id: postId, author_id: authorId, content });
  if (error) throw error;
}

export async function deleteComment(commentId: string, authorId: string) {
  const { error } = await supabase
    .from("sns_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export async function fetchCommentLikeInfo(
  commentId: string,
  userId: string | null,
): Promise<{ count: number; likedByMe: boolean }> {
  const { data } = await supabase
    .from("sns_comment_likes")
    .select("user_id")
    .eq("comment_id", commentId);
  const rows = data ?? [];
  return {
    count: rows.length,
    likedByMe: userId ? rows.some((r) => r.user_id === userId) : false,
  };
}

export async function toggleCommentLike(
  commentId: string,
  userId: string,
  liked: boolean,
) {
  if (liked) {
    await supabase
      .from("sns_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
  } else {
    await supabase
      .from("sns_comment_likes")
      .insert({ comment_id: commentId, user_id: userId });
  }
}
