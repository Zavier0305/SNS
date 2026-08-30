"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchPostsByIds, useFollowingIds } from "@/lib/posts-store";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function PostPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const { followingIds } = useFollowingIds(profile?.id ?? null);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  function refresh() {
    fetchPostsByIds([params.id], profile?.id ?? null).then((posts) =>
      setPost(posts[0] ?? null),
    );
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, profile?.id]);

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        {post === undefined ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : post === null ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            投稿が見つかりません（削除された可能性があります）。
          </p>
        ) : (
          <PostCard
            post={post}
            currentUserId={profile.id}
            isFollowing={followingIds.has(post.authorId)}
            onDeleted={() => router.push("/")}
          />
        )}
      </main>
    </>
  );
}
