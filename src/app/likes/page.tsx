"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchLikedPosts, useFollowingIds } from "@/lib/posts-store";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import type { Post } from "@/lib/types";

export default function LikesPage() {
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
    fetchLikedPosts(profile.id)
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
          いいねした投稿
        </h1>
        {loading ? (
          <PostListSkeleton />
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            いいねした投稿はまだありません。
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
