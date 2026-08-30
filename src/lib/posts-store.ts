"use client";

import { useCallback, useEffect, useState } from "react";
import { POST_IMAGE_BUCKET, supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { FeedKind, Post } from "@/lib/types";

const FEED_PAGE_SIZE = 100;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type FeedRow = Database["public"]["Views"]["sns_feed"]["Row"];

function hotScore(likeCount: number, commentCount: number, createdAt: string): number {
  const hoursSincePost =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return (likeCount + commentCount * 2) / Math.pow(Math.max(hoursSincePost, 0) + 2, 1.5);
}

function toPost(row: FeedRow, likedByMe: boolean): Post | null {
  if (!row.id || !row.author_id) return null;
  return {
    id: row.id,
    authorId: row.author_id,
    authorHandle: row.author_handle ?? "",
    authorDisplayName: row.author_display_name ?? "名無しさん",
    content: row.content ?? "",
    imageUrl: row.image_url,
    createdAt: row.created_at ?? new Date().toISOString(),
    expireAt: row.expire_at ?? new Date().toISOString(),
    isPreserved: row.is_preserved ?? false,
    isHidden: row.is_hidden ?? false,
    likeCount: row.like_count ?? 0,
    likedByMe,
    commentCount: row.comment_count ?? 0,
  };
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("sns_follows")
    .select("followee_id")
    .eq("follower_id", userId);
  return (data ?? []).map((row) => row.followee_id);
}

async function fetchMyLikedPostIds(
  userId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await supabase
    .from("sns_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  return new Set((data ?? []).map((row) => row.post_id));
}

async function fetchPosts(
  feed: FeedKind,
  userId: string | null,
): Promise<Post[]> {
  let query = supabase
    .from("sns_feed")
    .select("*")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (feed === "following") {
    if (!userId) return [];
    const followingIds = await fetchFollowingIds(userId);
    if (followingIds.length === 0) return [];
    query = query.in("author_id", followingIds);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const postIds = data.map((row) => row.id).filter((id): id is string => !!id);
  const likedIds = userId
    ? await fetchMyLikedPostIds(userId, postIds)
    : new Set<string>();

  const posts = data
    .map((row) => toPost(row, likedIds.has(row.id ?? "")))
    .filter((post): post is Post => post !== null);

  if (feed === "recommended") {
    posts.sort(
      (a, b) =>
        hotScore(b.likeCount, b.commentCount, b.createdAt) -
        hotScore(a.likeCount, a.commentCount, a.createdAt),
    );
  }

  return posts;
}

export async function fetchPostsByAuthor(
  authorId: string,
  viewerId: string | null,
): Promise<Post[]> {
  const { data, error } = await supabase
    .from("sns_feed")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE);
  if (error || !data) return [];

  const postIds = data.map((row) => row.id).filter((id): id is string => !!id);
  const likedIds = viewerId
    ? await fetchMyLikedPostIds(viewerId, postIds)
    : new Set<string>();

  return data
    .map((row) => toPost(row, likedIds.has(row.id ?? "")))
    .filter((post): post is Post => post !== null);
}

export async function deletePost(postId: string, authorId: string) {
  const { error } = await supabase
    .from("sns_posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export function usePosts(feed: FeedKind, userId: string | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchPosts(feed, userId)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [feed, userId]);

  useEffect(() => {
    // Kicks off the initial fetch on mount / when feed or user changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { posts, loading, refresh };
}

export async function addPost(
  authorId: string,
  content: string,
  imageFile: File | null,
) {
  let imageUrl: string | null = null;

  if (imageFile) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      throw new Error("画像は5MB以下にしてください");
    }
    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const path = `${authorId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(POST_IMAGE_BUCKET)
      .upload(path, imageFile);
    if (uploadError) throw uploadError;
    imageUrl = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path)
      .data.publicUrl;
  }

  const { error } = await supabase
    .from("sns_posts")
    .insert({ author_id: authorId, content, image_url: imageUrl });
  if (error) throw error;
}

export async function toggleLike(
  postId: string,
  userId: string,
  liked: boolean,
) {
  if (liked) {
    await supabase
      .from("sns_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  } else {
    await supabase.from("sns_likes").insert({ post_id: postId, user_id: userId });
  }
}

export async function toggleFollow(
  followeeId: string,
  followerId: string,
  following: boolean,
) {
  if (following) {
    await supabase
      .from("sns_follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("followee_id", followeeId);
  } else {
    await supabase
      .from("sns_follows")
      .insert({ follower_id: followerId, followee_id: followeeId });
  }
}

export function useFollowingIds(userId: string | null) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!userId) {
      setIds(new Set());
      return;
    }
    fetchFollowingIds(userId).then((list) => setIds(new Set(list)));
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { followingIds: ids, refresh };
}
