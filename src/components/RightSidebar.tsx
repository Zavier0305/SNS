"use client";

import Link from "next/link";
import { useTrendingTags } from "@/lib/discovery-store";
import { ServersIcon, SparkleIcon, SettingsIcon, BattleIcon } from "@/components/icons";

export function RightSidebar() {
  const { tags } = useTrendingTags();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 gap-4 px-4 py-4">
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <span aria-hidden="true">🏆</span>
          みんなのトレンドランキング
        </h2>
        {tags.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40">まだトレンドはありません</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {tags.slice(0, 8).map((t, i) => (
              <li key={t.tag}>
                <Link
                  href={`/tag/${t.tag}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <span
                    className={`rank-medal ${
                      i === 0
                        ? "rank-medal-1"
                        : i === 1
                          ? "rank-medal-2"
                          : i === 2
                            ? "rank-medal-3"
                            : "rank-medal-plain"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-accent truncate flex-1">#{t.tag}</span>
                  <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                    {t.count}件
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-1 text-sm">
        <Link
          href="/explore"
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
            <SparkleIcon className="h-4 w-4" />
          </span>
          発見
        </Link>
        <Link
          href="/servers"
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
            <ServersIcon className="h-4 w-4" />
          </span>
          サーバー一覧
        </Link>
        <Link
          href="/battle"
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
            <BattleIcon className="h-4 w-4" />
          </span>
          バトル履歴
        </Link>
        <Link
          href="/staff-k7v2q"
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
            <SettingsIcon className="h-4 w-4" />
          </span>
          管理ダッシュボード
        </Link>
      </div>
    </aside>
  );
}
