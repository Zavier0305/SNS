"use client";

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
      <span className="font-semibold">SNS</span>
      {profile && (
        <div className="flex items-center gap-3 text-sm">
          <span>{profile.displayName}</span>
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
