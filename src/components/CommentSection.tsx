"use client";

import { useState, type FormEvent } from "react";
import { addComment, deleteComment, useComments } from "@/lib/comments-store";
import { useToast } from "@/lib/toast-context";

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

  return (
    <div className="mt-2 pl-3 border-l-2 border-black/10 dark:border-white/10 flex flex-col gap-2">
      {loading ? (
        <p className="text-xs text-black/40 dark:text-white/40">読み込み中...</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{comment.authorDisplayName}</span>
              <span className="text-black/40 dark:text-white/40">
                {formatTime(comment.createdAt)}
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
          </div>
        ))
      )}
      {currentUserId && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="コメントする"
            maxLength={280}
            className="flex-1 rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="text-xs rounded-full bg-foreground text-background px-3 disabled:opacity-40"
          >
            送信
          </button>
        </form>
      )}
    </div>
  );
}
