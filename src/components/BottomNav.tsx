"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/search", label: "検索", icon: "🔍" },
  { href: "/explore", label: "発見", icon: "✨" },
  { href: "/notifications", label: "通知", icon: "🔔" },
  { href: "/profile", label: "自分", icon: "👤" },
] as const;

export function BottomNav() {
  const { profile } = useAuth();
  const pathname = usePathname();

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
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] ${
              active ? "text-foreground" : "text-black/40 dark:text-white/40"
            }`}
          >
            <span aria-hidden="true" className="text-base">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
