"use client";

import type { Battle } from "@/lib/battles-store";

export function BattleResultModal({
  battle,
  challengerName,
  opponentName,
  viewerIsChallenger,
  onClose,
}: {
  battle: Battle;
  challengerName: string;
  opponentName: string;
  viewerIsChallenger: boolean;
  onClose: () => void;
}) {
  const rounds = [
    { label: "投稿数", a: battle.challengerPosts, b: battle.opponentPosts },
    { label: "累計いいね", a: battle.challengerLikes, b: battle.opponentLikes },
    { label: "フォロワー数", a: battle.challengerFollowers, b: battle.opponentFollowers },
  ];
  const isDraw = battle.winnerId === null;
  const viewerWon =
    !isDraw &&
    ((viewerIsChallenger && battle.winnerId === battle.challengerId) ||
      (!viewerIsChallenger && battle.winnerId === battle.opponentId));

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="バトル結果"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-background border border-black/10 dark:border-white/10 p-5 shadow-lg"
      >
        <h2 className="text-center text-lg font-bold mb-1">⚔️ バトル結果</h2>
        <p className="text-center text-sm text-black/50 dark:text-white/50 mb-4">
          {challengerName} vs {opponentName}
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {rounds.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between text-sm rounded-md border border-black/10 dark:border-white/10 px-3 py-2"
            >
              <span
                className={`w-12 font-semibold ${r.a > r.b ? "text-blue-500" : "text-black/40 dark:text-white/40"}`}
              >
                {r.a}
              </span>
              <span className="text-xs text-black/40 dark:text-white/40">{r.label}</span>
              <span
                className={`w-12 text-right font-semibold ${r.b > r.a ? "text-red-500" : "text-black/40 dark:text-white/40"}`}
              >
                {r.b}
              </span>
            </div>
          ))}
        </div>
        <p className="text-center text-base font-bold mb-4">
          {isDraw ? "🤝 引き分け" : viewerWon ? "🎉 あなたの勝利！" : "😢 あなたの敗北..."}
          <span className="block text-xs font-normal text-black/50 dark:text-white/50 mt-0.5">
            {battle.challengerRoundWins} - {battle.opponentRoundWins}
          </span>
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-full bg-foreground text-background py-2 text-sm font-medium hover:opacity-90"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
