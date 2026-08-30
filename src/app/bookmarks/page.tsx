"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchBookmarkedPosts } from "@/lib/bookmarks-store";
import { useFollowingIds } from "@/lib/posts-store";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function BookmarksPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { followingIds } = useFollowingIds(profile?.id ?? null);

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
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          ブックマーク
        </h1>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            ブックマークした投稿はまだありません。
          </p>
        ) : (
          posts.map((post) => (
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
