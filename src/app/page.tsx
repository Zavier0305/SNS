"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds, usePosts } from "@/lib/posts-store";
import { Header } from "@/components/Header";
import { PostForm } from "@/components/PostForm";
import { PostCard } from "@/components/PostCard";
import type { FeedKind } from "@/lib/types";

export default function Home() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [feed, setFeed] = useState<FeedKind>("recommended");
  const userId = profile?.id ?? null;
  const { posts, loading, refresh } = usePosts(feed, userId);
  const { followingIds, refresh: refreshFollowing } = useFollowingIds(userId);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  if (!checked || !profile) return null;

  function handleFollowChange() {
    refreshFollowing();
    if (feed === "following") refresh();
  }

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <PostForm authorId={profile.id} onPosted={refresh} />
        <div className="flex border-b border-black/10 dark:border-white/10">
          {(
            [
              { key: "recommended", label: "おすすめ" },
              { key: "following", label: "フォロー中" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFeed(tab.key)}
              className={`flex-1 py-2 text-sm font-medium ${
                feed === tab.key
                  ? "border-b-2 border-foreground"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            読み込み中...
          </p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            {feed === "following"
              ? "フォロー中のユーザーの投稿はまだありません。"
              : "まだ投稿がありません。最初の投稿をしてみましょう。"}
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              isFollowing={followingIds.has(post.authorId)}
              onFollowChange={handleFollowChange}
              onDeleted={refresh}
            />
          ))
        )}
      </main>
    </>
  );
}
