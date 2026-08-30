"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds, usePosts } from "@/lib/posts-store";
import { fetchPreservedPosts } from "@/lib/discovery-store";
import { fetchSuggestedProfiles } from "@/lib/follows-store";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import type { Post, Profile } from "@/lib/types";

export default function ExplorePage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"trending" | "hallOfFame">("trending");
  const userId = profile?.id ?? null;
  const { posts: trendingPosts, loading: loadingTrending } = usePosts("recommended", userId);
  const [preservedPosts, setPreservedPosts] = useState<Post[]>([]);
  const [loadingPreserved, setLoadingPreserved] = useState(true);
  const { followingIds } = useFollowingIds(userId);
  const [suggested, setSuggested] = useState<Profile[]>([]);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    fetchPreservedPosts(userId)
      .then(setPreservedPosts)
      .finally(() => setLoadingPreserved(false));
  }, [userId]);

  useEffect(() => {
    if (userId) fetchSuggestedProfiles(userId).then(setSuggested);
  }, [userId]);

  if (!checked || !profile) return null;

  const posts = tab === "trending" ? trendingPosts.slice(0, 20) : preservedPosts;
  const loading = tab === "trending" ? loadingTrending : loadingPreserved;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        {suggested.length > 0 && (
          <div className="p-4 border-b border-black/10 dark:border-white/10">
            <h2 className="text-xs font-semibold text-black/50 dark:text-white/50 mb-2">
              おすすめユーザー
            </h2>
            <div className="flex gap-3 overflow-x-auto">
              {suggested.map((u) => (
                <Link
                  key={u.id}
                  href={`/u/${u.handle}`}
                  className="shrink-0 w-28 rounded-md border border-black/10 dark:border-white/10 p-2 text-center hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <p className="text-xs font-semibold truncate">{u.displayName}</p>
                  <p className="text-[10px] text-black/40 dark:text-white/40 truncate">
                    @{u.handle}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
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
