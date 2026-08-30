"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { joinViaInvite } from "@/lib/servers-store";
import { Header } from "@/components/Header";

export default function ServerInvitePage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const attempted = useRef(false);

  useEffect(() => {
    if (checked && !profile) {
      router.push(`/login?redirect=/servers/invite/${params.id}`);
    }
  }, [checked, profile, router, params.id]);

  useEffect(() => {
    if (!profile || attempted.current) return;
    attempted.current = true;
    joinViaInvite(params.id)
      .then((serverId) => {
        showToast("サーバーに参加しました");
        router.push(`/servers/${serverId}`);
      })
      .catch(() => {
        setStatus("error");
      });
  }, [profile, params.id, router, showToast]);

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto p-4">
        {status === "joining" ? (
          <p className="text-sm text-black/50 dark:text-white/50">参加中...</p>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            招待リンクが無効か、参加に失敗しました。
          </p>
        )}
      </main>
    </>
  );
}
