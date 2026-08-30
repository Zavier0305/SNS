"use client";

import { useEffect, useState } from "react";
import { fetchCommentLikeInfo, toggleCommentLike } from "@/lib/comments-store";

export function CommentLikeButton({
  commentId,
  currentUserId,
}: {
  commentId: string;
  currentUserId: string | null;
}) {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    fetchCommentLikeInfo(commentId, currentUserId).then(({ count, likedByMe }) => {
      setCount(count);
      setLiked(likedByMe);
    });
  }, [commentId, currentUserId]);

  async function handleClick() {
    if (!currentUserId) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    try {
      await toggleCommentLike(commentId, currentUserId, liked);
    } catch {
      setLiked(liked);
      setCount((c) => c + (liked ? 1 : -1));
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={!currentUserId}
      aria-label={liked ? "コメントのいいねを取り消す" : "コメントにいいねする"}
      aria-pressed={liked}
      className={`inline-flex items-center gap-0.5 ${
        liked ? "text-pink-500" : "text-black/40 dark:text-white/40"
      }`}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
