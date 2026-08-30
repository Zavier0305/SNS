"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { addComment, deleteComment, useComments } from "@/lib/comments-store";
import { useToast } from "@/lib/toast-context";
import { CommentLikeButton } from "@/components/CommentLikeButton";
import { formatRelativeTime } from "@/lib/format-time";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentSection({
  postId,
  currentUserId,
  onCommentCountChange,
}: {
  postId: string;
  currentUserId: string | null;
  onCommentCountChange?: (delta: number) => void;
}) {
  const { comments, loading, refresh } = useComments(postId, true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !currentUserId || submitting) return;
    setSubmitting(true);
    try {
      await addComment(postId, currentUserId, trimmed);
      setContent("");
      refresh();
      onCommentCountChange?.(1);
    } catch {
      showToast("コメントの投稿に失敗しました", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!currentUserId) return;
    try {
      await deleteComment(commentId, currentUserId);
      refresh();
      onCommentCountChange?.(-1);
    } catch {
      showToast("削除に失敗しました", "error");
    }
  }

  useEffect(() => {
    if (currentUserId) inputRef.current?.focus();
  }, [currentUserId]);

  function handleReply(handle: string) {
    if (!handle) return;
    setContent((prev) => (prev.startsWith(`@${handle} `) ? prev : `@${handle} ${prev}`));
    inputRef.current?.focus();
  }

  return (
    <div className="mt-2 pl-3 border-l-2 border-black/10 dark:border-white/10 flex flex-col gap-2">
      {loading ? (
        <p className="text-xs text-black/40 dark:text-white/40">読み込み中...</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{comment.authorDisplayName}</span>
              <span className="text-black/40 dark:text-white/40" title={formatTime(comment.createdAt)}>
                {formatRelativeTime(comment.createdAt)}
              </span>
              {comment.authorId === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-black/40 dark:text-white/40 hover:text-red-500"
                >
                  削除
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words">{comment.content}</p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px]">
              <CommentLikeButton commentId={comment.id} currentUserId={currentUserId} />
              {currentUserId && comment.authorHandle && (
                <button
                  onClick={() => handleReply(comment.authorHandle)}
                  className="text-black/40 dark:text-white/40 hover:underline"
                >
                  返信
                </button>
              )}
            </div>
          </div>
        ))
      )}
      {currentUserId && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="コメントする"
            maxLength={280}
            className="flex-1 rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="text-xs rounded-full bg-foreground text-background px-3 disabled:opacity-40 transition active:scale-95"
          >
            送信
          </button>
        </form>
      )}
    </div>
  );
}
