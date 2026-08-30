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

  const composeTarget = pathname.startsWith("/servers/") ? pathname : "/";
  const composeActive = pathname === "/compose";

  return (
    <aside className="hidden sm:flex sm:flex-col sm:w-60 sm:shrink-0 sm:h-screen sm:sticky sm:top-0 border-r border-black/10 dark:border-white/10 px-3 py-4">
      <Link href="/" className="px-2 py-2 text-lg font-bold">
        SNS
      </Link>

      <nav className="mt-3 flex flex-col gap-0.5" aria-label="メインナビゲーション">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
            pathname === "/"
              ? "bg-foreground/[0.06] dark:bg-foreground/10 font-semibold"
              : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          <HomeIcon className="h-5 w-5 shrink-0" />
          <span>ホーム</span>
        </Link>
        <Link
          href={composeTarget}
          aria-current={composeActive ? "page" : undefined}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-background bg-foreground hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="h-5 w-5 shrink-0" />
          <span>投稿する</span>
        </Link>
        {NAV_ITEMS.slice(1).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
                active
                  ? "bg-foreground/[0.06] dark:bg-foreground/10 font-semibold"
                  : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
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
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
            pathname === "/settings"
              ? "bg-foreground/[0.06] dark:bg-foreground/10 font-semibold"
              : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          <SettingsIcon className="h-5 w-5 shrink-0" />
          <span>設定</span>
        </Link>
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 pt-3 border-t border-black/10 dark:border-white/10">
        <ThemeToggle />
        <div className="flex items-center gap-1 rounded-md pl-1 pr-2 hover:bg-black/5 dark:hover:bg-white/10">
          <Link href="/profile" className="flex flex-1 min-w-0 items-center gap-3 px-2 py-2">
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
          <button
            onClick={handleLogout}
            aria-label="ログアウト"
            className="shrink-0 p-1.5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
