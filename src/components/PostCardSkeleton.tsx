export function PostCardSkeleton() {
  return (
    <div className="p-4 border-b border-black/10 dark:border-white/10 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-3 w-24 rounded bg-black/10 dark:bg-white/10" />
        <div className="h-3 w-12 rounded bg-black/10 dark:bg-white/10" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-black/10 dark:bg-white/10" />
        <div className="h-3 w-3/4 rounded bg-black/10 dark:bg-white/10" />
      </div>
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-8 rounded bg-black/10 dark:bg-white/10" />
        <div className="h-3 w-8 rounded bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </>
  );
}
