"use client";

import { useState } from "react";
import { REACTION_EMOJIS, toggleReaction, useReactions } from "@/lib/reactions-store";
import { ReactionsModal } from "@/components/ReactionsModal";

export function ReactionBar({
  postId,
  currentUserId,
}: {
  postId: string;
  currentUserId: string | null;
}) {
  const { reactions, refresh } = useReactions(postId, currentUserId);
  const [showReactors, setShowReactors] = useState(false);
  const totalCount = Object.values(reactions).reduce((sum, r) => sum + r.count, 0);

  async function handleClick(emoji: string) {
    if (!currentUserId) return;
    const reacted = reactions[emoji]?.reactedByMe ?? false;
    try {
      await toggleReaction(postId, currentUserId, emoji, reacted);
      refresh();
    } catch {
      // ignore; refresh will resync on next render
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1 flex-wrap">
      {REACTION_EMOJIS.map((emoji) => {
        const info = reactions[emoji];
        if (!info && !currentUserId) return null;
        return (
          <button
            key={emoji}
            onClick={() => handleClick(emoji)}
            disabled={!currentUserId}
            className={`text-xs rounded-full border px-1.5 py-0.5 ${
              info?.reactedByMe
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                : "border-black/10 dark:border-white/15"
            }`}
          >
            {emoji} {info?.count ?? ""}
          </button>
        );
      })}
      {totalCount > 0 && (
        <button
          onClick={() => setShowReactors(true)}
          className="text-[11px] text-black/40 dark:text-white/40 hover:underline"
        >
          誰がリアクションしたか見る
        </button>
      )}
      {showReactors && (
        <ReactionsModal postId={postId} onClose={() => setShowReactors(false)} />
      )}
    </div>
  );
}
