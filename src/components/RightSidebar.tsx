"use client";

import Link from "next/link";
import { useTrendingTags } from "@/lib/discovery-store";
import { ServersIcon, SparkleIcon, SettingsIcon, BattleIcon } from "@/components/icons";

export function RightSidebar() {
  const { tags } = useTrendingTags();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 gap-4 px-4 py-4">
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
        <h2 className="text-sm font-semibold mb-3">トレンド</h2>
        {tags.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40">まだトレンドはありません</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tags.slice(0, 8).map((t) => (
              <Link
                key={t.tag}
                href={`/tag/${t.tag}`}
                className="flex items-baseline justify-between text-sm hover:underline"
              >
                <span className="text-blue-500 truncate">#{t.tag}</span>
                <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                  {t.count}件
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-2.5 text-sm">
        <Link href="/explore" className="flex items-center gap-2 hover:underline">
          <SparkleIcon className="h-4 w-4 text-black/40 dark:text-white/40" />
          発見
        </Link>
        <Link href="/servers" className="flex items-center gap-2 hover:underline">
          <ServersIcon className="h-4 w-4 text-black/40 dark:text-white/40" />
          サーバー一覧
        </Link>
        <Link href="/battle" className="flex items-center gap-2 hover:underline">
          <BattleIcon className="h-4 w-4 text-black/40 dark:text-white/40" />
          バトル履歴
        </Link>
        <Link href="/admin" className="flex items-center gap-2 hover:underline">
          <SettingsIcon className="h-4 w-4 text-black/40 dark:text-white/40" />
          管理ダッシュボード
        </Link>
      </div>
    </aside>
  );
}
