"use client";

import { useEffect, useState } from "react";
import { fetchPollCounts, votePoll } from "@/lib/posts-store";

export function PollWidget({
  postId,
  options,
  myVote,
  currentUserId,
}: {
  postId: string;
  options: string[];
  myVote: number | null;
  currentUserId: string | null;
}) {
  const [counts, setCounts] = useState<number[]>([]);
  const [vote, setVote] = useState<number | null>(myVote);

  useEffect(() => {
    fetchPollCounts(postId).then(setCounts);
  }, [postId]);

  const total = counts.reduce((sum, c) => sum + (c ?? 0), 0);

  async function handleVote(optionIndex: number) {
    if (!currentUserId) return;
    const previous = vote;
    setVote(optionIndex);
    setCounts((current) => {
      const next = [...current];
      if (previous !== null) next[previous] = Math.max(0, (next[previous] ?? 0) - 1);
      next[optionIndex] = (next[optionIndex] ?? 0) + 1;
      return next;
    });
    try {
      await votePoll(postId, currentUserId, optionIndex, previous);
    } catch {
      setVote(previous);
      fetchPollCounts(postId).then(setCounts);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {options.map((option, i) => {
        const count = counts[i] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isMine = vote === i;
        return (
          <button
            key={i}
            onClick={() => handleVote(i)}
            disabled={!currentUserId}
            className="relative w-full text-left rounded-md border border-black/10 dark:border-white/20 overflow-hidden text-xs"
          >
            <div
              className={`absolute inset-y-0 left-0 ${
                isMine ? "bg-blue-200 dark:bg-blue-900/50" : "bg-black/5 dark:bg-white/10"
              }`}
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center justify-between px-2 py-1.5">
              <span>{option}</span>
              <span className="text-black/50 dark:text-white/50">
                {pct}%（{count}）
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
