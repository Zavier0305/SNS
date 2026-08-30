"use client";

import { useEffect, useState } from "react";
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

async function countRows(
  table: "sns_profiles" | "sns_posts" | "sns_likes" | "sns_comments" | "sns_servers",
) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

const ADMIN_HANDLES = (process.env.NEXT_PUBLIC_ADMIN_HANDLES ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export default function AdminPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const isAdmin = !!profile && ADMIN_HANDLES.includes(profile.handle.toLowerCase());

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (!profile || !isAdmin) return;
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
  }, [profile, isAdmin]);

  if (!checked || !profile) return null;

  if (!isAdmin) {
    return (
      <>
        <main className="flex-1 w-full max-w-xl mx-auto">
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            ページが見つかりません。
          </p>
        </main>
      </>
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
      </main>
    </>
  );
}
