"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  fetchBlockedIds,
  fetchMutedIds,
  fetchPostsByAuthor,
  toggleBlock,
  toggleFollow,
  toggleMute,
} from "@/lib/posts-store";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { PostCard } from "@/components/PostCard";
import type { Post, Profile } from "@/lib/types";

export function ProfileView({
  profile,
  currentUserId,
  isFollowing,
  onFollowChange,
}: {
  profile: Profile;
  currentUserId: string | null;
  isFollowing: boolean;
  onFollowChange?: () => void;
}) {
  const { profile: myProfile, updateNickname, updateThemeColor } = useAuth();
  const { showToast } = useToast();
  const isOwnProfile = currentUserId === profile.id;
  const displayedThemeColor = isOwnProfile ? myProfile?.themeColor : profile.themeColor;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(isFollowing);
  const [nickname, setNickname] = useState(profile.displayName);
  const [savingNickname, setSavingNickname] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [savingColor, setSavingColor] = useState(false);

  const refresh = useMemo(
    () => () => {
      setLoading(true);
      fetchPostsByAuthor(profile.id, currentUserId)
        .then(setPosts)
        .finally(() => setLoading(false));
    },
    [profile.id, currentUserId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!currentUserId || isOwnProfile) return;
    Promise.all([fetchMutedIds(currentUserId), fetchBlockedIds(currentUserId)]).then(
      ([mutedIds, blockedIds]) => {
        setMuted(mutedIds.includes(profile.id));
        setBlocked(blockedIds.includes(profile.id));
      },
    );
  }, [currentUserId, isOwnProfile, profile.id]);

  const stats = useMemo(
    () => ({
      postCount: posts.length,
      totalLikes: posts.reduce((sum, p) => sum + p.likeCount, 0),
      preservedCount: posts.filter((p) => p.isPreserved).length,
    }),
    [posts],
  );

  async function handleFollow() {
    if (!currentUserId || isOwnProfile) return;
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    try {
      await toggleFollow(profile.id, currentUserId, following);
      onFollowChange?.();
    } catch {
      setFollowing(following);
    }
  }

  async function handleMute() {
    if (!currentUserId) return;
    const next = !muted;
    setMuted(next);
    try {
      await toggleMute(profile.id, currentUserId, muted);
      showToast(next ? "ミュートしました" : "ミュートを解除しました");
    } catch {
      setMuted(muted);
      showToast("操作に失敗しました", "error");
    }
  }

  async function handleBlock() {
    if (!currentUserId) return;
    if (!blocked && !confirm("このユーザーをブロックしますか？（相互フォローは解除されます）")) {
      return;
    }
    const next = !blocked;
    setBlocked(next);
    try {
      await toggleBlock(profile.id, currentUserId, blocked);
      showToast(next ? "ブロックしました" : "ブロックを解除しました");
      if (next) {
        setFollowing(false);
        onFollowChange?.();
      }
    } catch {
      setBlocked(blocked);
      showToast("操作に失敗しました", "error");
    }
  }

  async function handleSaveNickname(e: FormEvent) {
    e.preventDefault();
    if (savingNickname) return;
    setSavingNickname(true);
    try {
      await updateNickname(nickname);
      showToast("ニックネームを変更しました");
    } catch {
      showToast("変更に失敗しました", "error");
    } finally {
      setSavingNickname(false);
    }
  }

  async function handleColorChange(color: string) {
    setSavingColor(true);
    try {
      await updateThemeColor(color);
    } catch {
      showToast("テーマカラーの保存に失敗しました", "error");
    } finally {
      setSavingColor(false);
    }
  }

  return (
    <div>
      {displayedThemeColor && (
        <div className="h-2 w-full" style={{ backgroundColor: displayedThemeColor }} />
      )}
      <div className="p-4 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {isOwnProfile ? myProfile?.displayName ?? profile.displayName : profile.displayName}
            </h1>
            <p className="text-xs text-black/40 dark:text-white/40">
              @{profile.handle}
            </p>
          </div>
          {!isOwnProfile && currentUserId && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFollow}
                className="text-sm rounded-full border border-black/20 dark:border-white/20 px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10"
              >
                {following ? "フォロー中" : "フォロー"}
              </button>
              <button
                onClick={handleMute}
                className={`text-xs rounded-full border px-2 py-1 ${
                  muted
                    ? "border-black/40 dark:border-white/40"
                    : "border-black/20 dark:border-white/20"
                }`}
              >
                {muted ? "ミュート中" : "ミュート"}
              </button>
              <button
                onClick={handleBlock}
                className={`text-xs rounded-full border px-2 py-1 ${
                  blocked
                    ? "border-red-500 text-red-500"
                    : "border-black/20 dark:border-white/20"
                }`}
              >
                {blocked ? "ブロック中" : "ブロック"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-4 text-xs text-black/60 dark:text-white/60">
          <span>投稿 {stats.postCount}</span>
          <span>累計いいね {stats.totalLikes}</span>
          <span>🏆殿堂入り {stats.preservedCount}</span>
        </div>

        {isOwnProfile && (
          <>
            <form onSubmit={handleSaveNickname} className="mt-3 flex gap-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="flex-1 rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
              />
              <button
                type="submit"
                disabled={savingNickname || !nickname.trim()}
                className="text-sm rounded-full bg-foreground text-background px-3 disabled:opacity-40"
              >
                保存
              </button>
            </form>
            <div className="mt-2 flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
              <label htmlFor="theme-color">テーマカラー</label>
              <input
                id="theme-color"
                type="color"
                value={displayedThemeColor ?? "#3b82f6"}
                onChange={(e) => handleColorChange(e.target.value)}
                disabled={savingColor}
                className="h-6 w-10 rounded border border-black/10 dark:border-white/20 bg-transparent"
              />
            </div>
          </>
        )}
      </div>

      {loading ? (
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
            currentUserId={currentUserId}
            isFollowing={following}
            onDeleted={refresh}
          />
        ))
      )}
    </div>
  );
}
