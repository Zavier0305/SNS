"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-black/70 dark:text-white/70">
          エラーが発生しました。もう一度お試しください。
        </p>
        <button
          onClick={reset}
          className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          再試行する
        </button>
      </div>
    </main>
  );
}
