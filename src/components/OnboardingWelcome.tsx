"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PlusIcon, ServersIcon, SearchIcon } from "@/components/icons";

const STORAGE_KEY = "sns.onboarded";

const STEPS = [
  {
    Icon: PlusIcon,
    color: "text-blue-500 bg-blue-500/10",
    title: "投稿する",
    body: "「いまどうしてる？」をタップすると投稿を作成できます。",
  },
  {
    Icon: ServersIcon,
    color: "text-purple-500 bg-purple-500/10",
    title: "サーバーに参加",
    body: "興味のあるコミュニティサーバーを見つけて参加しましょう。",
  },
  {
    Icon: SearchIcon,
    color: "text-green-500 bg-green-500/10",
    title: "検索・発見",
    body: "キーワードやハッシュタグで気になる投稿を探せます。",
  },
] as const;

export function OnboardingWelcome() {
  const { profile, checked } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!checked || !profile) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShow(true);
      }
    } catch {
      // localStorage unavailable; skip onboarding rather than show it every visit
    }
  }, [checked, profile]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="ようこそ"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-background border border-black/10 dark:border-white/10 p-5 shadow-lg"
      >
        <h2 className="text-lg font-bold mb-1">ようこそ SNS へ</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-4">
          はじめる前に、できることを簡単にご紹介します。
        </p>
        <div className="flex flex-col gap-3 mb-5">
          {STEPS.map((step) => (
            <div key={step.title} className="flex items-start gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.color}`}
              >
                <step.Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-black/50 dark:text-white/50">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={dismiss}
          className="w-full rounded-full bg-foreground text-background py-2 text-sm font-medium hover:opacity-90"
        >
          はじめる
        </button>
      </div>
    </div>
  );
}
