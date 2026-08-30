"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { fetchPostsByChannel } from "@/lib/posts-store";
import {
  approveJoinRequest,
  createChannel,
  fetchChannels,
  fetchJoinRequests,
  fetchMembers,
  fetchServer,
  joinServer,
  kickMember,
  leaveServer,
  rejectJoinRequest,
  setMemberRole,
  type Channel,
  type JoinRequest,
  type Server,
  type ServerMember,
} from "@/lib/servers-store";
import { Header } from "@/components/Header";
import { PostForm } from "@/components/PostForm";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function ServerPage() {
  const { profile, checked } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();

  const [server, setServer] = useState<Server | null | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [newChannelName, setNewChannelName] = useState("");

  const isModerator = server?.myRole === "owner" || server?.myRole === "moderator";
  const isMember = !!server?.myRole;

  function refreshServer() {
    fetchServer(params.id, profile?.id ?? null).then(setServer);
    fetchChannels(params.id).then((list) => {
      setChannels(list);
      setActiveChannelId((current) => current ?? list[0]?.id ?? null);
    });
  }

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  useEffect(() => {
    if (profile) refreshServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, params.id]);

  useEffect(() => {
    if (!activeChannelId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingPosts(true);
    fetchPostsByChannel(activeChannelId, profile?.id ?? null)
      .then(setPosts)
      .finally(() => setLoadingPosts(false));
  }, [activeChannelId, profile?.id]);

  function refreshManage() {
    fetchMembers(params.id).then(setMembers);
    fetchJoinRequests(params.id).then(setJoinRequests);
  }

  useEffect(() => {
    if (showManage) refreshManage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManage]);

  async function handleJoinToggle() {
    if (!profile || !server) return;
    try {
      if (server.myRole) {
        await leaveServer(server.id);
        showToast("退出しました");
      } else {
        await joinServer(server.id);
        showToast(server.isPublic ? "参加しました" : "参加をリクエストしました");
      }
      refreshServer();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  async function handleCreateChannel(e: FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      await createChannel(params.id, newChannelName.trim());
      setNewChannelName("");
      refreshServer();
    } catch {
      showToast("チャンネル作成に失敗しました", "error");
    }
  }

  async function handleApprove(userId: string) {
    try {
      await approveJoinRequest(params.id, userId);
      refreshManage();
    } catch {
      showToast("承認に失敗しました", "error");
    }
  }

  async function handleReject(userId: string) {
    try {
      await rejectJoinRequest(params.id, userId);
      refreshManage();
    } catch {
      showToast("却下に失敗しました", "error");
    }
  }

  async function handleKick(userId: string) {
    if (!confirm("このメンバーを退出させますか？")) return;
    try {
      await kickMember(params.id, userId);
      refreshManage();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  async function handleRoleChange(userId: string, role: "moderator" | "member") {
    try {
      await setMemberRole(params.id, userId, role);
      refreshManage();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        {server === undefined ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : server === null ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            サーバーが見つかりません。
          </p>
        ) : (
          <>
            <div className="p-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold">{server.name}</h1>
                  {server.topic && (
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {server.topic}
                    </p>
                  )}
                  <p className="text-[10px] text-black/40 dark:text-white/40">
                    メンバー {server.memberCount}・
                    {server.isPublic ? "公開" : "申請制"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isModerator && (
                    <button
                      onClick={() => setShowManage((v) => !v)}
                      className="text-xs rounded-full border border-black/20 dark:border-white/20 px-2 py-1"
                    >
                      管理
                    </button>
                  )}
                  <button
                    onClick={handleJoinToggle}
                    disabled={server.myRole === "owner"}
                    className="text-xs rounded-full border border-black/20 dark:border-white/20 px-3 py-1 disabled:opacity-40"
                  >
                    {server.myRole ? "退出" : server.isPublic ? "参加" : "参加申請"}
                  </button>
                </div>
              </div>
            </div>

            {showManage && isModerator && (
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex flex-col gap-3 bg-black/[0.02] dark:bg-white/[0.03]">
                {joinRequests.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold mb-1">参加リクエスト</h3>
                    {joinRequests.map((r) => (
                      <div key={r.userId} className="flex items-center justify-between text-xs py-1">
                        <span>{r.displayName} @{r.handle}</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(r.userId)} className="text-blue-500">承認</button>
                          <button onClick={() => handleReject(r.userId)} className="text-red-500">却下</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold mb-1">メンバー</h3>
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between text-xs py-1">
                      <span>
                        {m.displayName} @{m.handle}{" "}
                        <span className="text-black/40 dark:text-white/40">({m.role})</span>
                      </span>
                      {m.role !== "owner" && server.myRole === "owner" && (
                        <div className="flex gap-2">
                          {m.role === "member" ? (
                            <button onClick={() => handleRoleChange(m.userId, "moderator")} className="text-blue-500">
                              モデレーターにする
                            </button>
                          ) : (
                            <button onClick={() => handleRoleChange(m.userId, "member")} className="text-black/50 dark:text-white/50">
                              モデレーター解除
                            </button>
                          )}
                          <button onClick={() => handleKick(m.userId)} className="text-red-500">
                            Kick
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex overflow-x-auto border-b border-black/10 dark:border-white/10">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`shrink-0 px-3 py-2 text-sm ${
                    activeChannelId === c.id
                      ? "border-b-2 border-foreground font-medium"
                      : "text-black/50 dark:text-white/50"
                  }`}
                >
                  #{c.name}
                </button>
              ))}
              {isModerator && (
                <form onSubmit={handleCreateChannel} className="flex items-center px-2">
                  <input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="+チャンネル"
                    maxLength={30}
                    className="w-20 text-xs bg-transparent outline-none border-b border-black/10 dark:border-white/20"
                  />
                </form>
              )}
            </div>

            {isMember && activeChannelId && (
              <PostForm
                authorId={profile.id}
                channelId={activeChannelId}
                onPosted={() =>
                  fetchPostsByChannel(activeChannelId, profile.id).then(setPosts)
                }
              />
            )}

            {loadingPosts ? (
              <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
            ) : posts.length === 0 ? (
              <p className="p-4 text-sm text-black/50 dark:text-white/50">
                まだ投稿がありません。
              </p>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={profile.id}
                  isFollowing={false}
                  canModerate={isModerator}
                  onPinChange={() =>
                    activeChannelId &&
                    fetchPostsByChannel(activeChannelId, profile.id).then(setPosts)
                  }
                  onDeleted={() =>
                    activeChannelId &&
                    fetchPostsByChannel(activeChannelId, profile.id).then(setPosts)
                  }
                />
              ))
            )}
          </>
        )}
      </main>
    </>
  );
}
