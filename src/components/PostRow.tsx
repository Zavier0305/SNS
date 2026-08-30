"use client";

import Link from "next/link";
import type { Post } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { formatRelativeTime } from "@/lib/format-time";

export function PostRow({ post, index }: { post: Post; index: number }) {
  const preview = post.isSensitive ? "⚠️ 閲覧注意の投稿" : post.content || "（画像投稿）";

  return (
    <Link
      href={`/post/${post.id}`}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
    >
      <span className="w-5 shrink-0 text-right text-xs font-semibold text-black/30 dark:text-white/30">
        {index + 1}
      </span>
      <Avatar
        name={post.authorDisplayName}
        handle={post.authorHandle}
        avatarUrl={post.authorAvatarUrl}
        className="h-7 w-7 text-xs shrink-0"
      />
      <span className="min-w-0 flex-1 flex items-baseline gap-1.5">
        <span className="shrink-0 text-sm font-semibold">{post.authorDisplayName}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-black/70 dark:text-white/70">
          {preview}
        </span>
      </span>
      <span className="shrink-0 flex items-center gap-2 text-[11px] text-black/40 dark:text-white/40">
        {post.imageUrls.length > 0 && <span aria-hidden="true">📷</span>}
        {post.pollOptions && <span aria-hidden="true">📊</span>}
        {post.quotedPostId && <span aria-hidden="true">🔁</span>}
        <span>♡{post.likeCount}</span>
        <span>💬{post.commentCount}</span>
        <span className="hidden sm:inline">{formatRelativeTime(post.createdAt)}</span>
      </span>
    </Link>
  );
}
