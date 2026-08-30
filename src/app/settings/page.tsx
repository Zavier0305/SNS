"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { toggleBlock, toggleMute } from "@/lib/posts-store";
import { fetchBlockedProfiles, fetchMutedProfiles } from "@/lib/moderation-lists-store";
import { fetchNotificationPrefs } from "@/lib/profiles-store";
import { addMuteWord, fetchMuteWords, removeMuteWord } from "@/lib/mute-words-store";
import { usePushNotifications } from "@/lib/push-notifications";
import { Header } from "@/components/Header";
import type { NotificationPrefs, Profile } from "@/lib/types";

export default function SettingsPage() {
  const { profile, checked, updateNotificationPrefs, deleteAccount } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [muted, setMuted] = useState<Profile[]>([]);
  const [blocked, setBlocked] = useState<Profile[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [muteWords, setMuteWords] = useState<string[]>([]);
  const [newMuteWord, setNewMuteWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { supported: pushSupported, permission: pushPermission, requestPermission } =
    usePushNotifications();

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
      fetchMuteWords(profile.id),
    ])
      .then(([m, b, p, mw]) => {
        setMuted(m);
        setBlocked(b);
        setPrefs(p);
        setMuteWords(mw);
      })
      .finally(() => setLoading(false));
  }

  async function handleAddMuteWord(e: FormEvent) {
    e.preventDefault();
    if (!profile || !newMuteWord.trim()) return;
    try {
      await addMuteWord(profile.id, newMuteWord);
      setNewMuteWord("");
      refresh();
    } catch {
      showToast("追加に失敗しました", "error");
    }
  }

  async function handleRemoveMuteWord(word: string) {
    if (!profile) return;
    try {
      await removeMuteWord(profile.id, word);
      refresh();
    } catch {
      showToast("削除に失敗しました", "error");
    }
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

  async function handleDeleteAccount() {
    if (deletingAccount) return;
    if (!confirm("アカウントを削除しますか？投稿・コメント・フォローなど全てのデータが失われ、元に戻せません。")) {
      return;
    }
    if (!confirm("本当によろしいですか？この操作は取り消せません。")) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      router.push("/login");
    } catch {
      showToast("アカウントの削除に失敗しました", "error");
      setDeletingAccount(false);
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
            {pushSupported && (
              <section className="p-4 border-b border-black/10 dark:border-white/10">
                <h2 className="text-sm font-semibold mb-2">ブラウザ通知</h2>
                {pushPermission === "granted" ? (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    有効です（タブを開いたまま他の作業をしていると通知が届きます）
                  </p>
                ) : pushPermission === "denied" ? (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    ブラウザの設定で通知がブロックされています
                  </p>
                ) : (
                  <button
                    onClick={requestPermission}
                    className="text-sm rounded-full border border-black/20 dark:border-white/20 px-3 py-1"
                  >
                    通知を許可する
                  </button>
                )}
              </section>
            )}
            <section className="p-4 border-b border-black/10 dark:border-white/10">
              <h2 className="text-sm font-semibold mb-2">ミュートワード</h2>
              <form onSubmit={handleAddMuteWord} className="flex gap-2 mb-2">
                <input
                  value={newMuteWord}
                  onChange={(e) => setNewMuteWord(e.target.value)}
                  placeholder="非表示にしたいキーワード"
                  maxLength={40}
                  className="flex-1 rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={!newMuteWord.trim()}
                  className="text-sm rounded-full bg-foreground text-background px-3 disabled:opacity-40"
                >
                  追加
                </button>
              </form>
              {muteWords.length === 0 ? (
                <p className="text-xs text-black/50 dark:text-white/50">なし</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {muteWords.map((w) => (
                    <span
                      key={w}
                      className="text-xs rounded-full bg-black/5 dark:bg-white/10 px-2 py-1 flex items-center gap-1"
                    >
                      {w}
                      <button
                        onClick={() => handleRemoveMuteWord(w)}
                        aria-label={`${w}を削除`}
                        className="text-black/40 dark:text-white/40 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
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
            <section className="p-4 border-b border-black/10 dark:border-white/10">
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
            <section className="p-4 border-b border-black/10 dark:border-white/10">
              <Link href="/reports" className="text-sm text-blue-500 hover:underline">
                通報履歴を見る
              </Link>
            </section>
            <section className="p-4">
              <h2 className="text-sm font-semibold mb-2 text-red-500">危険な操作</h2>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="text-sm rounded-full border border-red-500 text-red-500 px-3 py-1 disabled:opacity-40"
              >
                {deletingAccount ? "削除中..." : "アカウントを削除する"}
              </button>
            </section>
          </>
        )}
      </main>
    </>
  );
}
