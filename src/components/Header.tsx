"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUnreadNotificationCount } from "@/lib/notifications-store";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const { count } = useUnreadNotificationCount(profile?.id ?? null);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-semibold">
        SNS
      </Link>
      {profile && (
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <Link href="/servers" className="hover:underline text-black/60 dark:text-white/60">
            サーバー
          </Link>
          <Link
            href="/bookmarks"
            aria-label="ブックマーク"
            className="hover:underline text-black/60 dark:text-white/60"
          >
            🔖
          </Link>
          <Link
            href="/notifications"
            aria-label={count > 0 ? `通知（未読${count}件）` : "通知"}
            className="relative hover:underline text-black/60 dark:text-white/60"
          >
            <span aria-hidden="true">🔔</span>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
          <Link href="/settings" aria-label="設定" className="hover:underline text-black/60 dark:text-white/60">
            <span aria-hidden="true">⚙️</span>
          </Link>
          <Link href="/profile" className="hover:underline">
            {profile.displayName}
          </Link>
          <span className="text-black/40 dark:text-white/40 text-xs">
            @{profile.handle}
          </span>
          <button
            onClick={handleLogout}
            className="text-black/60 dark:text-white/60 hover:underline"
          >
            ログアウト
          </button>
        </div>
      )}
    </header>
  );
}
