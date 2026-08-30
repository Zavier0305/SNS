"use client";

import { useState } from "react";
import { reportContent, toggleBlock, toggleMute } from "@/lib/posts-store";
import { useToast } from "@/lib/toast-context";
import { useConfirm } from "@/lib/confirm-context";

const REPORT_REASONS = [
  "スパム・宣伝",
  "ハラスメント・嫌がらせ",
  "不適切な画像・表現",
  "誤情報・デマ",
  "その他",
] as const;

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
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportComment, setReportComment] = useState("");
  const [reportAlsoBlock, setReportAlsoBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  async function submitReport() {
    if (reporting) return;
    setReporting(true);
    const reason = reportComment.trim()
      ? `${reportReason}: ${reportComment.trim()}`
      : reportReason;
    try {
      await reportContent(currentUserId, { postId }, reason);
      if (reportAlsoBlock) {
        await toggleBlock(authorId, currentUserId, false);
        showToast("通報し、ブロックしました");
        onHidden?.();
      } else {
        showToast("通報しました");
      }
      setShowReportModal(false);
      setReportComment("");
      setReportAlsoBlock(false);
    } catch {
      showToast("通報に失敗しました", "error");
    } finally {
      setReporting(false);
    }
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
    if (
      !(await confirm({
        message: "このユーザーをブロックしますか？（相互フォローは解除されます）",
        confirmLabel: "ブロック",
        danger: true,
      }))
    )
      return;
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
            onClick={() => {
              setOpen(false);
              setShowReportModal(true);
            }}
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
      {showReportModal && (
        <div
          onClick={() => setShowReportModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="投稿を通報"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg bg-background border border-black/10 dark:border-white/10 p-4"
          >
            <h2 className="text-sm font-semibold mb-3">投稿を通報</h2>
            <fieldset className="flex flex-col gap-1.5 mb-3">
              <legend className="text-xs text-black/50 dark:text-white/50 mb-1">
                理由を選択してください
              </legend>
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                  />
                  {reason}
                </label>
              ))}
            </fieldset>
            <textarea
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder="補足（任意）"
              rows={2}
              maxLength={200}
              className="w-full resize-none rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
            />
            <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60 mt-2">
              <input
                type="checkbox"
                checked={reportAlsoBlock}
                onChange={(e) => setReportAlsoBlock(e.target.checked)}
              />
              このユーザーを同時にブロックする
            </label>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="text-xs text-black/50 dark:text-white/50"
              >
                キャンセル
              </button>
              <button
                onClick={submitReport}
                disabled={reporting}
                className="text-xs rounded-full bg-foreground text-background px-3 py-1.5 disabled:opacity-40"
              >
                通報する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
