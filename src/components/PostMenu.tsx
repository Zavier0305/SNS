"use client";

import { useState } from "react";
import { reportContent, toggleBlock, toggleMute } from "@/lib/posts-store";
import { useToast } from "@/lib/toast-context";

export function PostMenu({
  postId,
  authorId,
  currentUserId,
  onHidden,
}: {
  postId: string;
  authorId: string;
  currentUserId: string;
  onHidden?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  async function handleReport() {
    const reason = prompt("通報理由を入力してください");
    if (!reason?.trim()) return;
    const alsoBlock = confirm("このユーザーを同時にブロックしますか？");
    try {
      await reportContent(currentUserId, { postId }, reason.trim());
      if (alsoBlock) {
        await toggleBlock(authorId, currentUserId, false);
        showToast("通報し、ブロックしました");
        onHidden?.();
      } else {
        showToast("通報しました");
      }
    } catch {
      showToast("通報に失敗しました", "error");
    }
    setOpen(false);
  }

  async function handleMute() {
    try {
      await toggleMute(authorId, currentUserId, false);
      showToast("ミュートしました");
      onHidden?.();
    } catch {
      showToast("ミュートに失敗しました", "error");
    }
    setOpen(false);
  }

  async function handleBlock() {
    if (!confirm("このユーザーをブロックしますか？（相互フォローは解除されます）")) return;
    try {
      await toggleBlock(authorId, currentUserId, false);
      showToast("ブロックしました");
      onHidden?.();
    } catch {
      showToast("ブロックに失敗しました", "error");
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="投稿メニュー"
        aria-expanded={open}
        className="text-xs text-black/40 dark:text-white/40 px-1"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-black/10 dark:border-white/20 bg-background shadow-lg text-xs overflow-hidden">
          <button
            onClick={handleReport}
            className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            通報
          </button>
          <button
            onClick={handleMute}
            className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ミュート
          </button>
          <button
            onClick={handleBlock}
            className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-red-500"
          >
            ブロック
          </button>
        </div>
      )}
    </div>
  );
}
