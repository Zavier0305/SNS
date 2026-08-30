"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [mode, setMode] = useState<"new" | "password">("new");
  const [nickname, setNickname] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, loginWithPassword } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "password") {
        await loginWithPassword(handle.trim(), password);
      } else {
        await login(nickname.trim() || undefined);
      }
      router.push("/");
    } catch {
      setError(
        mode === "password"
          ? "ハンドル名またはパスワードが正しくありません。"
          : "ログインに失敗しました。もう一度お試しください。",
      );
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
          <h1 className="text-lg font-semibold">SNSへようこそ</h1>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-black/10 dark:border-white/15 p-1">
            {(
              [
                { key: "new", label: "はじめる" },
                { key: "password", label: "ログイン" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMode(m.key);
                  setError(null);
                }}
                className={`rounded-full py-1.5 text-sm font-semibold transition-colors ${
                  mode === m.key
                    ? "bg-accent text-white"
                    : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">
            {mode === "password"
              ? "以前パスワードを設定した場合、ハンドル名とパスワードで同じアカウントに戻れます。"
              : "メールアドレスや電話番号は不要です。匿名アカウントが自動で発行されます。"}
          </p>
        </div>
        {mode === "password" ? (
          <>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="ハンドル名（@なし）"
              autoFocus
              className="rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
            />
          </>
        ) : (
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="ニックネーム（任意）"
            maxLength={20}
            autoFocus
            className="rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting || (mode === "password" && (!handle.trim() || !password))}
          className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {submitting ? "準備中..." : mode === "password" ? "ログイン" : "はじめる"}
        </button>
      </form>
    </main>
  );
}
