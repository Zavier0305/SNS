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

function toPost(
  row: FeedRow,
  likedByMe: boolean,
  myPollVote: number | null,
): Post | null {
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
    quotedPostId: row.quoted_post_id,
    quotedContent: row.quoted_content,
    quotedAuthorHandle: row.quoted_author_handle,
    quotedAuthorDisplayName: row.quoted_author_display_name,
    pollOptions: Array.isArray(row.poll_options)
      ? (row.poll_options as string[])
      : null,
    myPollVote,
    channelId: row.channel_id,
    isPinned: row.is_pinned ?? false,
  };
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("sns_follows")
    .select("followee_id")
    .eq("follower_id", userId);
  return (data ?? []).map((row) => row.followee_id);
}

export async function fetchMutedIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("sns_mutes")
    .select("muted_user_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.muted_user_id);
}

export async function fetchBlockedIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("sns_blocks")
    .select("blocked_user_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.blocked_user_id);
}

async function fetchHiddenAuthorIds(userId: string): Promise<Set<string>> {
  const [muted, blocked] = await Promise.all([
    fetchMutedIds(userId),
    fetchBlockedIds(userId),
  ]);
  return new Set([...muted, ...blocked]);
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

async function fetchMyPollVotes(
  userId: string,
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();
  const { data } = await supabase
    .from("sns_poll_votes")
    .select("post_id, option_index")
    .eq("user_id", userId)
    .in("post_id", postIds);
  return new Map((data ?? []).map((row) => [row.post_id, row.option_index]));
}

async function fetchPosts(
  feed: FeedKind,
  userId: string | null,
): Promise<Post[]> {
  let query = supabase
    .from("sns_feed")
    .select("*")
    .eq("is_hidden", false)
    .is("channel_id", null)
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
  const [likedIds, pollVotes, hiddenAuthorIds] = userId
    ? await Promise.all([
        fetchMyLikedPostIds(userId, postIds),
        fetchMyPollVotes(userId, postIds),
        fetchHiddenAuthorIds(userId),
      ])
    : [new Set<string>(), new Map<string, number>(), new Set<string>()];

  const posts = data
    .filter((row) => !row.author_id || !hiddenAuthorIds.has(row.author_id))
    .map((row) =>
      toPost(
        row,
        likedIds.has(row.id ?? ""),
        pollVotes.get(row.id ?? "") ?? null,
      ),
    )
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

async function enrichAndSort(
  data: FeedRow[],
  viewerId: string | null,
): Promise<Post[]> {
  const postIds = data.map((row) => row.id).filter((id): id is string => !!id);
  const [likedIds, pollVotes] = viewerId
    ? await Promise.all([
        fetchMyLikedPostIds(viewerId, postIds),
        fetchMyPollVotes(viewerId, postIds),
      ])
    : [new Set<string>(), new Map<string, number>()];

  return data
    .map((row) =>
      toPost(
        row,
        likedIds.has(row.id ?? ""),
        pollVotes.get(row.id ?? "") ?? null,
      ),
    )
    .filter((post): post is Post => post !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  return enrichAndSort(data, viewerId);
}

export async function fetchPostsByIds(
  postIds: string[],
  viewerId: string | null,
): Promise<Post[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sns_feed")
    .select("*")
    .in("id", postIds)
    .limit(FEED_PAGE_SIZE);
  if (error || !data) return [];
  return enrichAndSort(data, viewerId);
}

export async function fetchPostsByChannel(
  channelId: string,
  viewerId: string | null,
): Promise<Post[]> {
  const { data, error } = await supabase
    .from("sns_feed")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE);
  if (error || !data) return [];
  const posts = await enrichAndSort(data, viewerId);
  return posts.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
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
  options?: {
    quotedPostId?: string | null;
    pollOptions?: string[] | null;
    channelId?: string | null;
  },
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

  const { error } = await supabase.from("sns_posts").insert({
    author_id: authorId,
    content,
    image_url: imageUrl,
    quoted_post_id: options?.quotedPostId ?? null,
    poll_options: options?.pollOptions ?? null,
    channel_id: options?.channelId ?? null,
  });
  if (error) throw error;
}

export async function votePoll(
  postId: string,
  userId: string,
  optionIndex: number,
  previousVote: number | null,
) {
  if (previousVote !== null) {
    await supabase
      .from("sns_poll_votes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  }
  if (previousVote === optionIndex) return;
  const { error } = await supabase
    .from("sns_poll_votes")
    .insert({ post_id: postId, user_id: userId, option_index: optionIndex });
  if (error) throw error;
}

export async function fetchPollCounts(postId: string): Promise<number[]> {
  const { data } = await supabase
    .from("sns_poll_votes")
    .select("option_index")
    .eq("post_id", postId);
  const counts: number[] = [];
  for (const row of data ?? []) {
    counts[row.option_index] = (counts[row.option_index] ?? 0) + 1;
  }
  return counts;
}

export async function reportContent(
  reporterId: string,
  target: { postId?: string; commentId?: string },
  reason: string,
) {
  const { error } = await supabase.from("sns_reports").insert({
    reporter_id: reporterId,
    post_id: target.postId ?? null,
    comment_id: target.commentId ?? null,
    reason,
  });
  if (error) throw error;
}

export async function toggleMute(
  mutedUserId: string,
  userId: string,
  muted: boolean,
) {
  if (muted) {
    await supabase
      .from("sns_mutes")
      .delete()
      .eq("user_id", userId)
      .eq("muted_user_id", mutedUserId);
  } else {
    await supabase
      .from("sns_mutes")
      .insert({ user_id: userId, muted_user_id: mutedUserId });
  }
}

export async function toggleBlock(
  blockedUserId: string,
  userId: string,
  blocked: boolean,
) {
  if (blocked) {
    await supabase
      .from("sns_blocks")
      .delete()
      .eq("user_id", userId)
      .eq("blocked_user_id", blockedUserId);
  } else {
    await supabase
      .from("sns_blocks")
      .insert({ user_id: userId, blocked_user_id: blockedUserId });
  }
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
