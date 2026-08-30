"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { toggleBlock, toggleMute } from "@/lib/posts-store";
import { fetchBlockedProfiles, fetchMutedProfiles } from "@/lib/moderation-lists-store";
import { fetchNotificationPrefs } from "@/lib/profiles-store";
import { Header } from "@/components/Header";
import type { NotificationPrefs, Profile } from "@/lib/types";

export default function SettingsPage() {
  const { profile, checked, updateNotificationPrefs } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [muted, setMuted] = useState<Profile[]>([]);
  const [blocked, setBlocked] = useState<Profile[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  function refresh() {
    if (!profile) return;
    setLoading(true);
    Promise.all([
      fetchMutedProfiles(profile.id),
      fetchBlockedProfiles(profile.id),
      fetchNotificationPrefs(profile.id),
    ])
      .then(([m, b, p]) => {
        setMuted(m);
        setBlocked(b);
        setPrefs(p);
      })
      .finally(() => setLoading(false));
  }

  async function handlePrefChange(key: keyof NotificationPrefs, value: boolean) {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await updateNotificationPrefs(next);
    } catch {
      showToast("設定の保存に失敗しました", "error");
      setPrefs(prefs);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleUnmute(userId: string) {
    if (!profile) return;
    try {
      await toggleMute(userId, profile.id, true);
      showToast("ミュートを解除しました");
      refresh();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  async function handleUnblock(userId: string) {
    if (!profile) return;
    try {
      await toggleBlock(userId, profile.id, true);
      showToast("ブロックを解除しました");
      refresh();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          設定
        </h1>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : (
          <>
            <section className="p-4 border-b border-black/10 dark:border-white/10">
              <h2 className="text-sm font-semibold mb-2">通知設定</h2>
              {prefs && (
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prefs.notifyLikes}
                      onChange={(e) => handlePrefChange("notifyLikes", e.target.checked)}
                    />
                    いいねされたら通知する
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prefs.notifyComments}
                      onChange={(e) => handlePrefChange("notifyComments", e.target.checked)}
                    />
                    コメントされたら通知する
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prefs.notifyFollows}
                      onChange={(e) => handlePrefChange("notifyFollows", e.target.checked)}
                    />
                    フォローされたら通知する
                  </label>
                </div>
              )}
            </section>
            <section className="p-4 border-b border-black/10 dark:border-white/10">
              <h2 className="text-sm font-semibold mb-2">ミュート中のユーザー</h2>
              {muted.length === 0 ? (
                <p className="text-xs text-black/50 dark:text-white/50">なし</p>
              ) : (
                muted.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm py-1.5">
                    <span>
                      {u.displayName}{" "}
                      <span className="text-xs text-black/40 dark:text-white/40">@{u.handle}</span>
                    </span>
                    <button
                      onClick={() => handleUnmute(u.id)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      解除
                    </button>
                  </div>
                ))
              )}
            </section>
            <section className="p-4">
              <h2 className="text-sm font-semibold mb-2">ブロック中のユーザー</h2>
              {blocked.length === 0 ? (
                <p className="text-xs text-black/50 dark:text-white/50">なし</p>
              ) : (
                blocked.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm py-1.5">
                    <span>
                      {u.displayName}{" "}
                      <span className="text-xs text-black/40 dark:text-white/40">@{u.handle}</span>
                    </span>
                    <button
                      onClick={() => handleUnblock(u.id)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      解除
                    </button>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
