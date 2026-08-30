"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds } from "@/lib/posts-store";
import { searchPosts } from "@/lib/discovery-store";
import { searchProfiles } from "@/lib/profiles-store";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import type { Post, Profile } from "@/lib/types";

type Mode = "posts" | "users";

export default function SearchPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("posts");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
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
      if (mode === "posts") {
        setPosts(await searchPosts(query, profile?.id ?? null));
      } else {
        setUsers(await searchProfiles(query));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!checked || !profile) return null;

  const results = mode === "posts" ? posts : users;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <div className="flex border-b border-black/10 dark:border-white/10">
          {(
            [
              { key: "posts", label: "投稿" },
              { key: "users", label: "ユーザー" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setMode(tab.key);
                setSearched(false);
              }}
              className={`flex-1 py-2 text-sm font-medium ${
                mode === tab.key
                  ? "border-b-2 border-foreground"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-4 flex gap-2 border-b border-black/10 dark:border-white/10"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "posts" ? "キーワードで検索" : "ユーザー名で検索"}
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
        ) : searched && results.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            該当する{mode === "posts" ? "投稿" : "ユーザー"}が見つかりませんでした。
          </p>
        ) : mode === "posts" ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profile.id}
              isFollowing={followingIds.has(post.authorId)}
            />
          ))
        ) : (
          users.map((user) => (
            <Link
              key={user.id}
              href={`/u/${user.handle}`}
              className="block p-4 border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="font-semibold text-sm">{user.displayName}</span>
              <span className="text-xs text-black/40 dark:text-white/40 ml-2">
                @{user.handle}
              </span>
            </Link>
          ))
        )}
      </main>
    </>
  );
}
