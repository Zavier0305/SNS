"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds } from "@/lib/posts-store";
import { fetchPostsByTag } from "@/lib/discovery-store";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function TagPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const params = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { followingIds } = useFollowingIds(profile?.id ?? null);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchPostsByTag(params.tag, profile?.id ?? null)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [params.tag, profile?.id]);

  if (!checked || !profile) return null;

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          #{params.tag}
        </h1>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            このタグの投稿はまだありません。
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
