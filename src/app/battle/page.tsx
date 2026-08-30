"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { battleRecord, fetchMyBattles, type Battle } from "@/lib/battles-store";
import { fetchProfilesByIds } from "@/lib/profiles-store";
import type { Profile } from "@/lib/types";

export default function BattlePage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [opponents, setOpponents] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchMyBattles(profile.id)
      .then(async (list) => {
        setBattles(list);
        const opponentIds = list.map((b) =>
          b.challengerId === profile.id ? b.opponentId : b.challengerId,
        );
        const profiles = await fetchProfilesByIds(opponentIds);
        setOpponents(Object.fromEntries(profiles.map((p) => [p.id, p])));
      })
      .finally(() => setLoading(false));
  }, [profile]);

  if (!checked || !profile) return null;

  const record = battleRecord(battles, profile.id);

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          ⚔️ バトル履歴
        </h1>
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex gap-4 text-sm">
          <span className="text-green-600 dark:text-green-400 font-semibold">
            {record.wins}勝
          </span>
          <span className="text-red-500 font-semibold">{record.losses}敗</span>
          {record.draws > 0 && (
            <span className="text-black/50 dark:text-white/50 font-semibold">
              {record.draws}分
            </span>
          )}
        </div>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : battles.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            まだバトルの記録がありません。他のユーザーのプロフィールから「⚔️
            バトル」を申し込んでみましょう。
          </p>
        ) : (
          battles.map((b) => {
            const isChallenger = b.challengerId === profile.id;
            const opponentId = isChallenger ? b.opponentId : b.challengerId;
            const opponent = opponents[opponentId];
            const result =
              b.winnerId === null ? "draw" : b.winnerId === profile.id ? "win" : "loss";
            const myWins = isChallenger ? b.challengerRoundWins : b.opponentRoundWins;
            const oppWins = isChallenger ? b.opponentRoundWins : b.challengerRoundWins;
            return (
              <div
                key={b.id}
                className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10 text-sm"
              >
                <div>
                  <p className="font-medium">{opponent?.displayName ?? "退会したユーザー"}</p>
                  {opponent && (
                    <Link
                      href={`/u/${opponent.handle}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      @{opponent.handle}
                    </Link>
                  )}
                  <p className="text-[10px] text-black/40 dark:text-white/40">
                    {new Date(b.createdAt).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                      result === "win"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : result === "loss"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50"
                    }`}
                  >
                    {result === "win" ? "勝利" : result === "loss" ? "敗北" : "引き分け"}
                  </span>
                  <p className="mt-0.5 text-[10px] text-black/40 dark:text-white/40">
                    {myWins} - {oppWins}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>
    </>
  );
}
