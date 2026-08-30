"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(nickname.trim() || undefined);
      router.push("/");
    } catch {
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 rounded-lg border border-black/10 dark:border-white/10 p-6"
      >
        <div>
          <h1 className="text-lg font-semibold">SNSをはじめる</h1>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            メールアドレスや電話番号は不要です。匿名アカウントが自動で発行されます。
          </p>
        </div>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="ニックネーム（任意）"
          maxLength={20}
          autoFocus
          className="rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {submitting ? "準備中..." : "はじめる"}
        </button>
      </form>
    </main>
  );
}
