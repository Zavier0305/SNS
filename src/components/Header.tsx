"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { profile, logout } = useAuth();
  const router = useRouter();

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
          <Link href="/servers" className="hover:underline text-black/60 dark:text-white/60">
            サーバー
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
