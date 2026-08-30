"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotificationCount } from "@/lib/notification-count-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  HomeIcon,
  SearchIcon,
  SparkleIcon,
  BellIcon,
  BookmarkIcon,
  ServersIcon,
  SettingsIcon,
  UserIcon,
  LogoutIcon,
  PlusIcon,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "ホーム", Icon: HomeIcon, badge: false },
  { href: "/search", label: "検索", Icon: SearchIcon, badge: false },
  { href: "/explore", label: "発見", Icon: SparkleIcon, badge: false },
  { href: "/notifications", label: "通知", Icon: BellIcon, badge: true },
  { href: "/bookmarks", label: "ブックマーク", Icon: BookmarkIcon, badge: false },
  { href: "/servers", label: "サーバー", Icon: ServersIcon, badge: false },
] as const;

export function Sidebar() {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useNotificationCount();

  if (!profile) return null;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="hidden sm:flex sm:flex-col sm:w-56 sm:shrink-0 sm:h-screen sm:sticky sm:top-0 border-r border-black/10 dark:border-white/10 px-3 py-4">
      <div className="flex items-center justify-between px-2 py-2">
        <Link href="/" className="text-lg font-bold">
          SNS
        </Link>
        <Link
          href="/"
          aria-label="投稿する"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
        </Link>
      </div>

      <nav className="mt-3 flex flex-col" aria-label="メインナビゲーション">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 border-l-2 px-3 py-2.5 text-[15px] transition-colors ${
                active
                  ? "border-foreground font-semibold"
                  : "border-transparent text-black/70 dark:text-white/70 hover:border-black/20 dark:hover:border-white/20"
              }`}
            >
              <item.Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
              {item.badge && count > 0 && (
                <span className="absolute left-6 top-1.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center px-1">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-black/10 dark:border-white/10">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-full px-3 py-2 text-sm text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <SettingsIcon className="h-4 w-4" />
          設定
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-full px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
            <UserIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{profile.displayName}</span>
            <span className="block truncate text-xs text-black/40 dark:text-white/40">
              @{profile.handle}
            </span>
          </span>
        </Link>
        <div className="flex items-center justify-between px-3 py-1">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            aria-label="ログアウト"
            className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white"
          >
            <LogoutIcon className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </div>
    </aside>
  );
}
