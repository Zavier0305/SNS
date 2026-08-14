"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { userName, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between">
      <span className="font-semibold">SNS</span>
      {userName && (
        <div className="flex items-center gap-3 text-sm">
          <span>{userName}</span>
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
