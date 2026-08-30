"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPostLikers, type Liker } from "@/lib/posts-store";

export function LikersModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [likers, setLikers] = useState<Liker[] | null>(null);

  useEffect(() => {
    fetchPostLikers(postId).then(setLikers);
  }, [postId]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="いいねしたユーザー"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-lg bg-background border border-black/10 dark:border-white/10 p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">いいねしたユーザー</h2>
          <button onClick={onClose} aria-label="閉じる" className="text-black/40 dark:text-white/40">
            ×
          </button>
        </div>
        {likers === null ? (
          <p className="text-xs text-black/50 dark:text-white/50">読み込み中...</p>
        ) : likers.length === 0 ? (
          <p className="text-xs text-black/50 dark:text-white/50">まだいいねがありません。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {likers.map((u) => (
              <Link
                key={u.id}
                href={`/u/${u.handle}`}
                onClick={onClose}
                className="text-sm hover:underline"
              >
                {u.displayName}{" "}
                <span className="text-xs text-black/40 dark:text-white/40">@{u.handle}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
