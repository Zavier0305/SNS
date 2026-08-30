"use client";

import { useState } from "react";
import type { Post } from "@/lib/types";
import { toggleFollow, toggleLike } from "@/lib/posts-store";

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostCard({
  post,
  currentUserId,
  isFollowing,
  onFollowChange,
}: {
  post: Post;
  currentUserId: string | null;
  isFollowing: boolean;
  onFollowChange?: () => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [following, setFollowing] = useState(isFollowing);
  const isOwnPost = currentUserId === post.authorId;

  async function handleLike() {
    if (!currentUserId) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => count + (nextLiked ? 1 : -1));
    try {
      await toggleLike(post.id, currentUserId, liked);
    } catch {
      setLiked(liked);
      setLikeCount(post.likeCount);
    }
  }

  async function handleFollow() {
    if (!currentUserId || isOwnPost) return;
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    try {
      await toggleFollow(post.authorId, currentUserId, following);
      onFollowChange?.();
    } catch {
      setFollowing(following);
    }
  }

  return (
    <article className="p-4 border-b border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-semibold text-sm truncate">
            {post.authorDisplayName}
          </span>
          <span className="text-xs text-black/40 dark:text-white/40 truncate">
            @{post.authorHandle}
          </span>
          <span className="text-xs text-black/50 dark:text-white/50 shrink-0">
            {formatTime(post.createdAt)}
          </span>
        </div>
        {!isOwnPost && currentUserId && (
          <button
            onClick={handleFollow}
            className="text-xs shrink-0 rounded-full border border-black/20 dark:border-white/20 px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {following ? "フォロー中" : "フォロー"}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm whitespace-pre-wrap break-words">
        {post.content}
      </p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="mt-2 rounded-lg max-h-80 w-auto object-cover"
        />
      )}
      <button
        onClick={handleLike}
        disabled={!currentUserId}
        className={`mt-2 flex items-center gap-1 text-xs ${
          liked ? "text-pink-500" : "text-black/50 dark:text-white/50"
        }`}
      >
        <span>{liked ? "♥" : "♡"}</span>
        <span>{likeCount}</span>
      </button>
    </article>
  );
}
