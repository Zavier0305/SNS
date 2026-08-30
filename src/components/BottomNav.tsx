"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotificationCount } from "@/lib/notification-count-context";
import { HomeIcon, SearchIcon, ServersIcon, BellIcon, UserIcon } from "@/components/icons";

const ITEMS = [
  { href: "/", label: "ホーム", Icon: HomeIcon, badge: false },
  { href: "/search", label: "検索", Icon: SearchIcon, badge: false },
  { href: "/servers", label: "サーバー", Icon: ServersIcon, badge: false },
  { href: "/notifications", label: "通知", Icon: BellIcon, badge: true },
  { href: "/profile", label: "自分", Icon: UserIcon, badge: false },
] as const;

export function BottomNav() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const { count } = useNotificationCount();

  if (!profile) return null;

  return (
    <nav
      aria-label="モバイルナビゲーション"
      className="sm:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-black/10 dark:border-white/10 bg-background"
    >
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${
              active ? "text-foreground" : "text-black/40 dark:text-white/40"
            }`}
          >
            <item.Icon className="h-5 w-5" />
            {item.label}
            {item.badge && count > 0 && (
              <span className="absolute top-1 right-[calc(50%-16px)] min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center px-0.5">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
