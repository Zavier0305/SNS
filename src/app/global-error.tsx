"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ja">
      <body className="min-h-full flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-sm text-black/70">
          アプリの読み込み中にエラーが発生しました。
        </p>
        <button
          onClick={reset}
          className="rounded-full bg-black text-white px-4 py-2 text-sm font-medium"
        >
          再試行する
        </button>
      </body>
    </html>
  );
}
