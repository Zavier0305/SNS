"use client";

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds } from "@/lib/posts-store";
import { searchPosts, useTrendingTags } from "@/lib/discovery-store";
import { searchProfiles } from "@/lib/profiles-store";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistoryItem,
} from "@/lib/search-history";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
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
  const [history, setHistory] = useState<string[]>([]);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [highlightKeywords, setHighlightKeywords] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const { followingIds } = useFollowingIds(profile?.id ?? null);
  const { tags: trendingTags } = useTrendingTags();

  const visiblePosts =
    mode === "posts" && followingOnly
      ? posts.filter((p) => followingIds.has(p.authorId))
      : posts;

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(getSearchHistory());
  }, []);

  async function runSearch(q: string, options: { recordHistory?: boolean } = {}) {
    const { recordHistory = true } = options;
    const trimmed = q.trim();
    if (!trimmed) return;
    const tagMatch = trimmed.match(/^#([\w぀-ヿ一-鿿]+)$/);
    if (tagMatch) {
      if (recordHistory) setHistory(addSearchHistory(trimmed));
      router.push(`/tag/${tagMatch[1].toLowerCase()}`);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      if (mode === "posts") {
        setPosts(await searchPosts(q, profile?.id ?? null));
        setHighlightKeywords(trimmed.split(/\s+/).filter(Boolean).slice(0, 5));
      } else {
        setUsers(await searchProfiles(q));
      }
      if (recordHistory) setHistory(addSearchHistory(q));
    } finally {
      setLoading(false);
    }
  }

  // Live search: once typing settles for a beat, search automatically instead
  // of making the user press 検索 every time. Exact "#tag" queries are left to
  // the tag-suggestion dropdown / explicit submit so this doesn't fire a
  // partial-tag search on every keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const timeout = setTimeout(() => {
      runSearch(query, { recordHistory: false });
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setShowTagSuggestions(false);
    await runSearch(query);
  }

  function handleHistoryClick(q: string) {
    setQuery(q);
    setShowTagSuggestions(false);
    runSearch(q);
  }

  function handleTagSuggestionClick(tag: string) {
    const q = `#${tag}`;
    setQuery(q);
    setShowTagSuggestions(false);
    runSearch(q);
  }

  const tagSuggestions =
    mode === "posts" && query.startsWith("#") && query.length > 1
      ? trendingTags
          .filter((t) => t.tag.toLowerCase().startsWith(query.slice(1).toLowerCase()))
          .slice(0, 6)
      : [];

  function handleRemoveHistory(e: MouseEvent, q: string) {
    e.stopPropagation();
    setHistory(removeSearchHistoryItem(q));
  }

  if (!checked || !profile) return null;

  const results = mode === "posts" ? visiblePosts : users;

  return (
    <>
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
          className="relative p-4 flex gap-2 border-b border-black/10 dark:border-white/10"
        >
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowTagSuggestions(true);
            }}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 100)}
            placeholder={mode === "posts" ? "キーワードで検索（#タグ可）" : "ユーザー名で検索"}
            className="flex-1 rounded-md border border-black/10 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            検索
          </button>
          {showTagSuggestions && tagSuggestions.length > 0 && (
            <div className="absolute left-4 right-20 top-full z-10 mt-1 rounded-md border border-black/10 dark:border-white/20 bg-background shadow-lg overflow-hidden">
              {tagSuggestions.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => handleTagSuggestionClick(t.tag)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="text-blue-500">#{t.tag}</span>
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {t.count}件
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>
        {mode === "posts" && (
          <label className="flex items-center gap-1.5 px-4 pb-3 text-xs text-black/60 dark:text-white/60 -mt-1">
            <input
              type="checkbox"
              checked={followingOnly}
              onChange={(e) => setFollowingOnly(e.target.checked)}
            />
            フォロー中のユーザーのみ
          </label>
        )}
        {!searched && history.length > 0 && (
          <div className="p-4 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-black/50 dark:text-white/50">
                最近の検索
              </h2>
              <button
                onClick={() => setHistory(clearSearchHistory())}
                className="text-xs text-black/40 dark:text-white/40 hover:underline"
              >
                すべて消去
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((q) => (
                <button
                  key={q}
                  onClick={() => handleHistoryClick(q)}
                  className="text-xs rounded-full bg-black/5 dark:bg-white/10 px-2 py-1 flex items-center gap-1"
                >
                  {q}
                  <span
                    onClick={(e) => handleRemoveHistory(e, q)}
                    role="button"
                    aria-label={`${q}を履歴から削除`}
                    className="text-black/40 dark:text-white/40 hover:text-red-500"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {loading ? (
          mode === "posts" ? (
            <PostListSkeleton />
          ) : (
            <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
          )
        ) : searched && results.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            該当する{mode === "posts" ? "投稿" : "ユーザー"}が見つかりませんでした。
          </p>
        ) : mode === "posts" ? (
          visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profile.id}
              isFollowing={followingIds.has(post.authorId)}
              highlightWords={highlightKeywords}
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
