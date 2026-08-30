"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds, usePosts } from "@/lib/posts-store";
import { fetchPreservedPosts } from "@/lib/discovery-store";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import type { Post } from "@/lib/types";

export default function ExplorePage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"trending" | "hallOfFame">("trending");
  const userId = profile?.id ?? null;
  const { posts: trendingPosts, loading: loadingTrending } = usePosts("recommended", userId);
  const [preservedPosts, setPreservedPosts] = useState<Post[]>([]);
  const [loadingPreserved, setLoadingPreserved] = useState(true);
  const { followingIds } = useFollowingIds(userId);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    fetchPreservedPosts(userId)
      .then(setPreservedPosts)
      .finally(() => setLoadingPreserved(false));
  }, [userId]);

  if (!checked || !profile) return null;

  const posts = tab === "trending" ? trendingPosts.slice(0, 20) : preservedPosts;
  const loading = tab === "trending" ? loadingTrending : loadingPreserved;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <div className="flex border-b border-black/10 dark:border-white/10">
          {(
            [
              { key: "trending", label: "急上昇" },
              { key: "hallOfFame", label: "🏆 殿堂入りギャラリー" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === t.key
                  ? "border-b-2 border-foreground"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {loading ? (
          <PostListSkeleton />
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            まだ投稿がありません。
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              isFollowing={followingIds.has(post.authorId)}
            />
          ))
        )}
      </main>
    </>
  );
}
