"use client";

import { useState, type FormEvent } from "react";
import { addPost } from "@/lib/posts-store";

export function PostForm({ authorName }: { authorName: string }) {
  const [content, setContent] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    addPost(authorName, trimmed);
    setContent("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4 border-b border-black/10 dark:border-white/10">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={3}
        maxLength={280}
        className="resize-none rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!content.trim()}
          className="rounded-full bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          投稿する
        </button>
      </div>
    </form>
  );
}
