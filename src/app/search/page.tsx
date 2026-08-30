"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds } from "@/lib/posts-store";
import { searchPosts } from "@/lib/discovery-store";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function SearchPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { followingIds } = useFollowingIds(profile?.id ?? null);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      setPosts(await searchPosts(query, profile?.id ?? null));
    } finally {
      setLoading(false);
    }
  }

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="p-4 flex gap-2 border-b border-black/10 dark:border-white/10"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードで検索"
            className="flex-1 rounded-md border border-black/10 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            検索
          </button>
        </form>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : searched && posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            該当する投稿が見つかりませんでした。
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profile.id}
              isFollowing={followingIds.has(post.authorId)}
            />
          ))
        )}
      </main>
    </>
  );
}
