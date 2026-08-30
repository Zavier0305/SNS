"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchBookmarkedPosts } from "@/lib/bookmarks-store";
import { useFollowingIds } from "@/lib/posts-store";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function BookmarksPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const { followingIds } = useFollowingIds(profile?.id ?? null);

  const filteredPosts = query.trim()
    ? posts.filter((p) => p.content.toLowerCase().includes(query.trim().toLowerCase()))
    : posts;

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  function refresh() {
    if (!profile) return;
    setLoading(true);
    fetchBookmarkedPosts(profile.id)
      .then(setPosts)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!checked || !profile) return null;

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          ブックマーク
        </h1>
        {posts.length > 0 && (
          <div className="p-4 border-b border-black/10 dark:border-white/10">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ブックマークを検索"
              className="w-full rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
            />
          </div>
        )}
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            ブックマークした投稿はまだありません。
          </p>
        ) : filteredPosts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            該当するブックマークが見つかりませんでした。
          </p>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profile.id}
              isFollowing={followingIds.has(post.authorId)}
              onDeleted={refresh}
            />
          ))
        )}
      </main>
    </>
  );
}
