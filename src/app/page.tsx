"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePosts } from "@/lib/posts-store";
import { Header } from "@/components/Header";
import { PostForm } from "@/components/PostForm";
import { PostCard } from "@/components/PostCard";

export default function Home() {
  const { userName, checked } = useAuth();
  const router = useRouter();
  const posts = usePosts();

  useEffect(() => {
    if (checked && !userName) router.push("/login");
  }, [checked, userName, router]);

  if (!checked || !userName) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <PostForm authorName={userName} />
        {posts.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            まだ投稿がありません。最初の投稿をしてみましょう。
          </p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </main>
    </>
  );
}
