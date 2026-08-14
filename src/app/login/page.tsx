"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [name, setName] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    login(trimmed);
    router.push("/");
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 rounded-lg border border-black/10 dark:border-white/10 p-6"
      >
        <h1 className="text-lg font-semibold">SNSにログイン</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ユーザー名"
          maxLength={20}
          autoFocus
          className="rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          はじめる
        </button>
      </form>
    </main>
  );
}
