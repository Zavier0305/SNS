"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  fetchNotifications,
  markAllNotificationsRead,
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

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (!profile) return;
    fetchNotifications(profile.id)
      .then(setNotifications)
      .finally(() => setLoading(false));
    markAllNotificationsRead(profile.id);
  }, [profile]);

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          通知
        </h1>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : notifications.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            通知はまだありません。
          </p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 border-b border-black/10 dark:border-white/10 text-sm ${
                !n.readAt ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
              }`}
            >
              <Link href={`/u/${n.actorHandle}`} className="font-semibold hover:underline">
                {n.actorDisplayName}
              </Link>
              <span>{LABELS[n.type]}</span>
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
