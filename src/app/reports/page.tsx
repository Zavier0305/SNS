"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

type ReportRow = {
  id: string;
  reason: string;
  createdAt: string;
  postId: string | null;
  commentId: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("sns_reports")
      .select("id, reason, created_at, post_id, comment_id")
      .eq("reporter_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReports(
          (data ?? []).map((r) => ({
            id: r.id,
            reason: r.reason,
            createdAt: r.created_at,
            postId: r.post_id,
            commentId: r.comment_id,
          })),
        );
        setLoading(false);
      });
  }, [profile]);

  if (!checked || !profile) return null;

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          通報履歴
        </h1>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : reports.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            通報した投稿・コメントはありません。
          </p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="p-4 border-b border-black/10 dark:border-white/10 text-sm">
              <p className="text-xs text-black/40 dark:text-white/40">
                {formatTime(r.createdAt)}・{r.postId ? "投稿" : "コメント"}を通報
              </p>
              <p className="mt-1">{r.reason}</p>
            </div>
          ))
        )}
      </main>
    </>
  );
}
