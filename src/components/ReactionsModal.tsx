"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchReactors, type Reactor } from "@/lib/reactions-store";

export function ReactionsModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [reactors, setReactors] = useState<Reactor[] | null>(null);

  useEffect(() => {
    fetchReactors(postId).then(setReactors);
  }, [postId]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="リアクションしたユーザー"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-lg bg-background border border-black/10 dark:border-white/10 p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">リアクションしたユーザー</h2>
          <button onClick={onClose} aria-label="閉じる" className="text-black/40 dark:text-white/40">
            ×
          </button>
        </div>
        {reactors === null ? (
          <p className="text-xs text-black/50 dark:text-white/50">読み込み中...</p>
        ) : reactors.length === 0 ? (
          <p className="text-xs text-black/50 dark:text-white/50">まだリアクションがありません。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {reactors.map((u) => (
              <Link
                key={`${u.id}-${u.emoji}`}
                href={`/u/${u.handle}`}
                onClick={onClose}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <span aria-hidden="true">{u.emoji}</span>
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
