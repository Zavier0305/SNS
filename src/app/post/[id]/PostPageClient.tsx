"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchPostsByIds, useFollowingIds } from "@/lib/posts-store";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { ComposeModal } from "@/components/ComposeModal";
import type { Post } from "@/lib/types";

export function PostPageClient({ postId }: { postId: string }) {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const { followingIds } = useFollowingIds(profile?.id ?? null);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  function refresh() {
    fetchPostsByIds([postId], profile?.id ?? null).then((posts) =>
      setPost(posts[0] ?? null),
    );
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, profile?.id]);

  if (!checked || !profile) return null;

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        {post === undefined ? (
          <PostListSkeleton count={1} />
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
            onQuote={setQuotedPost}
            defaultShowComments
          />
        )}
      </main>
      {quotedPost && (
        <ComposeModal
          authorId={profile.id}
          onPosted={refresh}
          quotedPost={quotedPost}
          onClose={() => setQuotedPost(null)}
        />
      )}
    </>
  );
}
