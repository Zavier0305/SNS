"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  battleRecord,
  fetchMyBattles,
  fetchMyRating,
  fetchPeriodRanking,
  fetchTopRatings,
  type Battle,
  type BattleRating,
  type PeriodRankingEntry,
} from "@/lib/battles-store";
import { tierForRating } from "@/lib/battle-rank";
import { fetchProfilesByIds } from "@/lib/profiles-store";
import type { Profile } from "@/lib/types";

type RankingTab = "all" | "week" | "month";

export default function BattlePage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [opponents, setOpponents] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState<BattleRating | null>(null);
  const [rankingTab, setRankingTab] = useState<RankingTab>("all");
  const [topRatings, setTopRatings] = useState<BattleRating[]>([]);
  const [periodRanking, setPeriodRanking] = useState<PeriodRankingEntry[]>([]);
  const [rankingProfiles, setRankingProfiles] = useState<Record<string, Profile>>({});
  const [rankingLoading, setRankingLoading] = useState(true);

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
    fetchMyRating(profile.id).then(setMyRating);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRankingLoading(true);
    const fetchList =
      rankingTab === "all"
        ? fetchTopRatings().then((list) => {
            setTopRatings(list);
            return list.map((r) => r.userId);
          })
        : fetchPeriodRanking(rankingTab).then((list) => {
            setPeriodRanking(list);
            return list.map((r) => r.userId);
          });
    fetchList
      .then((ids) => fetchProfilesByIds(ids))
      .then((profiles) => {
        setRankingProfiles(Object.fromEntries(profiles.map((p) => [p.id, p])));
      })
      .finally(() => setRankingLoading(false));
  }, [rankingTab]);

  if (!checked || !profile) return null;

  const record = battleRecord(battles, profile.id);
  const myTier = myRating ? tierForRating(myRating.rating) : tierForRating(1200);

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          ⚔️ バトル履歴
        </h1>
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-base font-bold">
            <span aria-hidden="true">{myTier.emoji}</span>
            {myTier.name}
            <span className="text-xs font-normal text-black/40 dark:text-white/40">
              (レート {myRating?.rating ?? 1200})
            </span>
          </span>
        </div>
        <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex gap-4 text-sm">
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

        <h2 className="p-4 pb-2 text-sm font-semibold text-black/60 dark:text-white/60">
          🏆 ランキング
        </h2>
        <div className="px-4 flex gap-2 text-xs">
          {(
            [
              { key: "all", label: "全期間" },
              { key: "week", label: "週間" },
              { key: "month", label: "月間" },
            ] as { key: RankingTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setRankingTab(t.key)}
              className={`rounded-full border px-3 py-1 ${
                rankingTab === t.key
                  ? "border-foreground bg-foreground text-background font-semibold"
                  : "border-black/20 dark:border-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4 pb-6 border-b border-black/10 dark:border-white/10">
          {rankingLoading ? (
            <p className="text-sm text-black/50 dark:text-white/50">読み込み中...</p>
          ) : rankingTab === "all" ? (
            topRatings.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">まだ記録がありません。</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {topRatings.map((r, i) => {
                  const p = rankingProfiles[r.userId];
                  const tier = tierForRating(r.rating);
                  return (
                    <li
                      key={r.userId}
                      className="flex items-center justify-between text-sm rounded-md border border-black/10 dark:border-white/10 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-right text-xs text-black/40 dark:text-white/40">
                          {i + 1}
                        </span>
                        {p ? (
                          <Link href={`/u/${p.handle}`} className="truncate hover:underline">
                            {p.displayName}
                          </Link>
                        ) : (
                          <span className="truncate">退会したユーザー</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 shrink-0 text-xs font-semibold">
                        <span aria-hidden="true">{tier.emoji}</span>
                        {r.rating}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )
          ) : periodRanking.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              この期間の記録はまだありません。
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {periodRanking.map((r, i) => {
                const p = rankingProfiles[r.userId];
                return (
                  <li
                    key={r.userId}
                    className="flex items-center justify-between text-sm rounded-md border border-black/10 dark:border-white/10 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-right text-xs text-black/40 dark:text-white/40">
                        {i + 1}
                      </span>
                      {p ? (
                        <Link href={`/u/${p.handle}`} className="truncate hover:underline">
                          {p.displayName}
                        </Link>
                      ) : (
                        <span className="truncate">退会したユーザー</span>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">
                      {r.wins}勝{r.losses}敗
                    </span>
                  </li>
                );
              })}
            </ol>
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
