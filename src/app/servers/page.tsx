"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  createServer,
  fetchServers,
  joinServer,
  leaveServer,
  type Server,
} from "@/lib/servers-store";
import { Header } from "@/components/Header";

export default function ServersPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  function refresh() {
    setLoading(true);
    fetchServers(profile?.id ?? null)
      .then(setServers)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createServer(profile.id, name.trim(), topic.trim(), isPublic);
      setName("");
      setTopic("");
      router.push(`/servers/${id}`);
    } catch {
      showToast("作成に失敗しました", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinToggle(server: Server) {
    if (!profile) return;
    try {
      if (server.myRole) {
        await leaveServer(server.id);
        showToast("退出しました");
      } else {
        await joinServer(server.id);
        showToast(server.isPublic ? "参加しました" : "参加をリクエストしました");
      }
      refresh();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  if (!checked || !profile) return null;

  const filteredServers = servers.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || (s.topic ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <form
          onSubmit={handleCreate}
          className="p-4 flex flex-col gap-2 border-b border-black/10 dark:border-white/10"
        >
          <h2 className="text-sm font-semibold">サーバーを作成</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="サーバー名"
            maxLength={40}
            className="rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="トピック（任意）"
            maxLength={80}
            className="rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              誰でも参加可（オフで申請制）
            </label>
            <button
              type="submit"
              disabled={!name.trim() || creating}
              className="rounded-full bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              作成
            </button>
          </div>
        </form>

        <div className="p-3 border-b border-black/10 dark:border-white/10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="サーバーを検索"
            className="w-full rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
        </div>

        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : filteredServers.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            {servers.length === 0 ? "サーバーはまだありません。" : "該当するサーバーがありません。"}
          </p>
        ) : (
          filteredServers.map((server) => (
            <div
              key={server.id}
              className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2"
            >
              <Link href={`/servers/${server.id}`} className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{server.name}</span>
                  <span className="text-[10px] rounded-full bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-black/50 dark:text-white/50">
                    {server.isPublic ? "公開" : "申請制"}
                  </span>
                </div>
                {server.topic && (
                  <p className="text-xs text-black/50 dark:text-white/50 truncate">
                    {server.topic}
                  </p>
                )}
                <p className="text-[10px] text-black/40 dark:text-white/40">
                  メンバー {server.memberCount}
                </p>
              </Link>
              <button
                onClick={() => handleJoinToggle(server)}
                disabled={server.myRole === "owner"}
                className="text-xs shrink-0 rounded-full border border-black/20 dark:border-white/20 px-3 py-1 disabled:opacity-40"
              >
                {server.myRole ? "参加中" : server.isPublic ? "参加" : "参加申請"}
              </button>
            </div>
          ))
        )}
      </main>
    </>
  );
}
