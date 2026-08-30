"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotificationCount } from "@/lib/notification-count-context";
import { fetchMyServers, type Server } from "@/lib/servers-store";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import {
  HomeIcon,
  SearchIcon,
  SparkleIcon,
  BellIcon,
  BookmarkIcon,
  ServersIcon,
  SettingsIcon,
  LogoutIcon,
  PlusIcon,
  MenuIcon,
  CloseIcon,
  BattleIcon,
} from "@/components/icons";

const RAIL_ITEMS = [
  { href: "/", label: "ホーム", Icon: HomeIcon, badge: false },
  { href: "/search", label: "検索", Icon: SearchIcon, badge: false },
  { href: "/notifications", label: "通知", Icon: BellIcon, badge: true },
] as const;

const DRAWER_ITEMS = [
  { href: "/explore", label: "発見", Icon: SparkleIcon },
  { href: "/bookmarks", label: "ブックマーク", Icon: BookmarkIcon },
  { href: "/servers", label: "サーバー", Icon: ServersIcon },
  { href: "/battle", label: "バトル", Icon: BattleIcon },
  { href: "/settings", label: "設定", Icon: SettingsIcon },
] as const;

const MAX_RAIL_SERVERS = 5;

export function Sidebar() {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useNotificationCount();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [myServers, setMyServers] = useState<Server[]>([]);

  useEffect(() => {
    if (!profile) return;
    fetchMyServers(profile.id).then(setMyServers);
  }, [profile]);

  if (!profile) return null;

  async function handleLogout() {
    setDrawerOpen(false);
    await logout();
    router.push("/login");
  }

  const composeTarget = pathname.startsWith("/servers/") ? pathname : "/";

  return (
    <>
      <aside className="hidden sm:flex sm:flex-col sm:w-16 sm:shrink-0 sm:h-screen sm:sticky sm:top-0 sm:items-center border-r border-black/10 dark:border-white/10 py-4 gap-1">
        <Link
          href="/"
          title="SNS"
          className="accent-pill flex h-10 w-10 items-center justify-center text-lg font-bold hover:opacity-90 transition-opacity"
        >
          S
        </Link>

        <nav className="mt-3 flex flex-col items-center gap-1.5" aria-label="メインナビゲーション">
          {RAIL_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                  active
                    ? "bg-accent text-white shadow-sm"
                    : "text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <item.Icon className="h-5 w-5" />
                {item.badge && count > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {myServers.length > 0 && (
          <>
            <div
              aria-hidden="true"
              className="my-1.5 h-px w-8 bg-black/10 dark:bg-white/10"
            />
            <nav
              className="flex flex-col items-center gap-1.5"
              aria-label="参加中のサーバー"
            >
              {myServers.slice(0, MAX_RAIL_SERVERS).map((s) => {
                const active = pathname === `/servers/${s.id}`;
                return (
                  <Link
                    key={s.id}
                    href={`/servers/${s.id}`}
                    title={s.name}
                    aria-label={s.name}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-full ${active ? "ring-2 ring-accent" : ""}`}
                  >
                    <Avatar name={s.name} handle={s.id} className="h-9 w-9 text-xs" />
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        <nav className="mt-1.5 flex flex-col items-center" aria-label="投稿する">
          <Link
            href={composeTarget}
            title="投稿する"
            aria-label="投稿する"
            className="accent-pill flex h-11 w-11 items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
          >
            <PlusIcon className="h-5 w-5" />
          </Link>
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={() => setDrawerOpen(true)}
            title="メニュー"
            aria-label="メニューを開く"
            aria-expanded={drawerOpen}
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <Link
            href="/profile"
            title={profile.displayName}
            aria-label="プロフィール"
            className="block rounded-full hover:opacity-80"
          >
            <Avatar
              name={profile.displayName}
              handle={profile.handle}
              avatarUrl={profile.avatarUrl}
              className="h-9 w-9 text-sm"
              ring
            />
          </Link>
        </div>
      </aside>

      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="メニュー"
          className="hidden sm:block fixed inset-0 z-50 bg-black/40"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-72 flex-col bg-background border-r border-black/10 dark:border-white/10 px-3 py-4"
          >
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-lg font-bold">SNS</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="メニューを閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-full text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-3 flex flex-col gap-0.5" aria-label="その他のメニュー">
              {DRAWER_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                      active
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <item.Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-0.5 pt-3 border-t border-black/10 dark:border-white/10">
              <ThemeToggle />
              <div className="flex items-center gap-1 rounded-md pl-1 pr-2 hover:bg-black/5 dark:hover:bg-white/10">
                <Link
                  href="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex flex-1 min-w-0 items-center gap-3 px-2 py-2"
                >
                  <Avatar
                    name={profile.displayName}
                    handle={profile.handle}
                    avatarUrl={profile.avatarUrl}
                    className="h-8 w-8 text-xs"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {profile.displayName}
                    </span>
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
          </div>
        </div>
      )}
    </>
  );
}
