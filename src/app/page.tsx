"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds, usePosts } from "@/lib/posts-store";
import { useTrendingTags } from "@/lib/discovery-store";
import { PostForm } from "@/components/PostForm";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import type { FeedKind, Post } from "@/lib/types";

function dateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  return date.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
}

export default function Home() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [feed, setFeed] = useState<FeedKind>("recommended");
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const userId = profile?.id ?? null;
  const { posts, loading, refresh, hasNew, loadMore, loadingMore, hasMore } = usePosts(
    feed,
    userId,
  );
  const { followingIds, refresh: refreshFollowing } = useFollowingIds(userId);
  const { tags } = useTrendingTags();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (!checked || !profile) return null;

  function handleFollowChange() {
    refreshFollowing();
    if (feed === "following") refresh();
  }

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <div className="p-3 flex items-center justify-between border-b border-black/10 dark:border-white/10">
          <Link
            href="/search"
            className="text-sm text-black/60 dark:text-white/60 hover:underline"
          >
            🔍 検索
          </Link>
        </div>
        {tags.length > 0 && (
          <div className="p-3 flex gap-2 overflow-x-auto border-b border-black/10 dark:border-white/10">
            {tags.map((t) => (
              <Link
                key={t.tag}
                href={`/tag/${t.tag}`}
                className="text-xs shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-2 py-1 hover:underline"
              >
                #{t.tag} ({t.count})
              </Link>
            ))}
          </div>
        )}
        <PostForm
          authorId={profile.id}
          onPosted={refresh}
          quotedPost={quotedPost}
          onCancelQuote={() => setQuotedPost(null)}
        />
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
        {hasNew && (
          <button
            onClick={refresh}
            className="w-full py-2 text-xs text-blue-500 border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
          >
            新着の投稿があります・クリックして更新
          </button>
        )}
        {loading ? (
          <PostListSkeleton />
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            {feed === "following"
              ? "フォロー中のユーザーの投稿はまだありません。"
              : "まだ投稿がありません。最初の投稿をしてみましょう。"}
          </p>
        ) : (
          posts.map((post, i) => {
            const label = dateLabel(post.createdAt);
            const showSeparator = i === 0 || dateLabel(posts[i - 1].createdAt) !== label;
            return (
              <div key={post.id}>
                {showSeparator && (
                  <div className="px-4 py-1.5 text-[11px] font-medium text-black/40 dark:text-white/40 bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/10 dark:border-white/10">
                    {label}
                  </div>
                )}
                <PostCard
                  post={post}
                  currentUserId={userId}
                  isFollowing={followingIds.has(post.authorId)}
                  onFollowChange={handleFollowChange}
                  onDeleted={refresh}
                  onQuote={setQuotedPost}
                />
              </div>
            );
          })
        )}
        <div ref={sentinelRef} />
        {loadingMore && (
          <p className="p-4 text-center text-xs text-black/40 dark:text-white/40">
            読み込み中...
          </p>
        )}
        {!loading && !hasMore && posts.length > 0 && (
          <p className="p-4 text-center text-xs text-black/40 dark:text-white/40">
            これ以上の投稿はありません
          </p>
        )}
      </main>
    </>
  );
}
