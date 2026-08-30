"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PlusIcon } from "@/components/icons";

// Post composers live inline on the home feed and inside a server channel view.
// The FAB just gets you to the nearest one instead of duplicating compose logic
// in a modal, and hides itself on pages where there's nowhere to post to.
const COMPOSE_HIDDEN_PREFIXES = ["/login", "/settings", "/notifications", "/post/"];

export function ComposeFab() {
  const { profile } = useAuth();
  const pathname = usePathname();

  if (!profile) return null;
  if (COMPOSE_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (pathname === "/") return null;

  const target = pathname.startsWith("/servers/") ? pathname : "/";

  return (
    <Link
      href={target}
      aria-label="投稿する"
      className="sm:hidden fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg active:opacity-80"
    >
      <PlusIcon className="h-6 w-6" />
    </Link>
  );
}
