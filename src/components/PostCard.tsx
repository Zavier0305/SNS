import type { Post } from "@/lib/types";

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="p-4 border-b border-black/10 dark:border-white/10">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-sm">{post.authorName}</span>
        <span className="text-xs text-black/50 dark:text-white/50">
          {formatTime(post.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-sm whitespace-pre-wrap break-words">
        {post.content}
      </p>
    </article>
  );
}
