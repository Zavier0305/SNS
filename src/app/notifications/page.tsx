"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications-store";
import { Header } from "@/components/Header";

const LABELS: Record<Notification["type"], string> = {
  like: "があなたの投稿にいいねしました",
  comment: "があなたの投稿にコメントしました",
  follow: "があなたをフォローしました",
  reaction: "があなたの投稿にリアクションしました",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Notification["type"]>("all");

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (!profile) return;
    fetchNotifications(profile.id)
      .then(setNotifications)
      .finally(() => setLoading(false));
  }, [profile]);

  async function handleMarkRead(id: string) {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
    );
    await markNotificationRead(id);
  }

  async function handleMarkAllRead() {
    if (!profile) return;
    setNotifications((current) =>
      current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    await markAllNotificationsRead(profile.id);
  }

  if (!checked || !profile) return null;

  const hasUnread = notifications.some((n) => !n.readAt);
  const filtered =
    filter === "all" ? notifications : notifications.filter((n) => n.type === filter);
  const FILTER_TABS: { key: "all" | Notification["type"]; label: string }[] = [
    { key: "all", label: "すべて" },
    { key: "like", label: "いいね" },
    { key: "comment", label: "コメント" },
    { key: "follow", label: "フォロー" },
    { key: "reaction", label: "リアクション" },
  ];

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
          <h1 className="text-lg font-semibold">通知</h1>
          {hasUnread && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-500 hover:underline"
            >
              すべて既読にする
            </button>
          )}
        </div>
        <div className="flex overflow-x-auto border-b border-black/10 dark:border-white/10">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`shrink-0 px-3 py-2 text-xs font-medium ${
                filter === t.key
                  ? "border-b-2 border-foreground"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            通知はまだありません。
          </p>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.readAt && handleMarkRead(n.id)}
              className={`p-4 border-b border-black/10 dark:border-white/10 text-sm ${
                !n.readAt ? "bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer" : ""
              }`}
            >
              <Link
                href={`/u/${n.actorHandle}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold hover:underline"
              >
                {n.actorDisplayName}
              </Link>
              <span>{LABELS[n.type]}</span>
              {!n.readAt && (
                <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />
              )}
              <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                {formatTime(n.createdAt)}
              </p>
            </div>
          ))
        )}
      </main>
    </>
  );
}
