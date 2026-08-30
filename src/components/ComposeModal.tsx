"use client";

import { PostForm } from "@/components/PostForm";
import { CloseIcon } from "@/components/icons";
import type { Post } from "@/lib/types";

export function ComposeModal({
  authorId,
  onPosted,
  quotedPost,
  onClose,
}: {
  authorId: string;
  onPosted: () => void;
  quotedPost?: Post | null;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="投稿する"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 sm:pt-24"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <div className="flex justify-end mb-1">
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 shadow"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <PostForm
          authorId={authorId}
          onPosted={() => {
            onPosted();
            onClose();
          }}
          quotedPost={quotedPost}
          onCancelQuote={onClose}
          startExpanded
        />
      </div>
    </div>
  );
}
