"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

type Stats = {
  users: number;
  posts: number;
  postsToday: number;
  likes: number;
  comments: number;
  servers: number;
  hiddenPosts: number;
  preservedPosts: number;
};

type ReportRow = {
  id: string;
  reason: string;
  createdAt: string;
  postId: string | null;
  commentId: string | null;
};

async function countRows(
  table: "sns_profiles" | "sns_posts" | "sns_likes" | "sns_comments" | "sns_servers",
) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("sns_profiles")
      .select("is_admin")
      .eq("id", profile.id)
      .single()
      .then(({ data }) => setIsAdmin(data?.is_admin ?? false));
  }, [profile]);

  useEffect(() => {
    if (!isAdmin) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      countRows("sns_profiles"),
      countRows("sns_posts"),
      supabase
        .from("sns_posts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString())
        .then(({ count }) => count ?? 0),
      countRows("sns_likes"),
      countRows("sns_comments"),
      countRows("sns_servers"),
      supabase
        .from("sns_posts")
        .select("*", { count: "exact", head: true })
        .eq("is_hidden", true)
        .then(({ count }) => count ?? 0),
      supabase
        .from("sns_posts")
        .select("*", { count: "exact", head: true })
        .eq("is_preserved", true)
        .then(({ count }) => count ?? 0),
    ]).then(
      ([users, posts, postsToday, likes, comments, servers, hiddenPosts, preservedPosts]) => {
        setStats({
          users,
          posts,
          postsToday,
          likes,
          comments,
          servers,
          hiddenPosts,
          preservedPosts,
        });
      },
    );

    supabase
      .from("sns_reports")
      .select("id, reason, created_at, post_id, comment_id")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setReports(
          (data ?? []).map((row) => ({
            id: row.id,
            reason: row.reason,
            createdAt: row.created_at,
            postId: row.post_id,
            commentId: row.comment_id,
          })),
        );
      });
  }, [isAdmin]);

  if (!checked || !profile || isAdmin === null) return null;

  if (!isAdmin) {
    return (
      <main className="flex-1 w-full max-w-xl mx-auto p-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          このページを見る権限がありません。
        </p>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          管理ダッシュボード
        </h1>
        {!stats ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : (
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              ["ユーザー数", stats.users],
              ["投稿数", stats.posts],
              ["本日の投稿", stats.postsToday],
              ["いいね数", stats.likes],
              ["コメント数", stats.comments],
              ["サーバー数", stats.servers],
              ["消滅済み投稿", stats.hiddenPosts],
              ["殿堂入り投稿", stats.preservedPosts],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-lg border border-black/10 dark:border-white/10 p-3"
              >
                <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
                <p className="text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        )}

        <h2 className="px-4 py-3 text-sm font-semibold border-y border-black/10 dark:border-white/10">
          通報まとめ（{reports.length}件）
        </h2>
        {reports.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">通報はまだありません。</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {reports.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <p className="whitespace-pre-wrap break-words">{r.reason}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-black/40 dark:text-white/40">
                  <span>{formatTime(r.createdAt)}</span>
                  {r.postId && (
                    <Link href={`/post/${r.postId}`} className="text-blue-500 hover:underline">
                      対象の投稿を見る
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
