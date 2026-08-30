"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  deletePost,
  fetchBlockedIds,
  fetchMutedIds,
  fetchPostsByAuthor,
  toggleBlock,
  toggleFollow,
  toggleMute,
} from "@/lib/posts-store";
import { fetchFollowCounts } from "@/lib/follows-store";
import { isBlockedBy } from "@/lib/moderation-lists-store";
import { uploadAvatarImage, uploadCoverImage } from "@/lib/profiles-store";
import { battleRecord, createBattle, fetchMyBattles, type Battle } from "@/lib/battles-store";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useConfirm } from "@/lib/confirm-context";
import { PostCard } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { Avatar } from "@/components/Avatar";
import { BattleResultModal } from "@/components/BattleResultModal";
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
  const {
    profile: myProfile,
    updateNickname,
    updateThemeColor,
    updateBio,
    updateCoverUrl,
    updateAvatarUrl,
  } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isOwnProfile = currentUserId === profile.id;
  const displayedThemeColor = isOwnProfile ? myProfile?.themeColor : profile.themeColor;
  const displayedProfile = isOwnProfile ? myProfile ?? profile : profile;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(isFollowing);
  const [nickname, setNickname] = useState(profile.displayName);
  const [savingNickname, setSavingNickname] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [myBattles, setMyBattles] = useState<Battle[]>([]);
  const [challenging, setChallenging] = useState(false);
  const [battleResult, setBattleResult] = useState<Battle | null>(null);

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
    isBlockedBy(profile.id).then(setBlockedByThem);
  }, [currentUserId, isOwnProfile, profile.id]);

  const refreshBattles = useMemo(
    () => () => {
      fetchMyBattles(profile.id).then(setMyBattles);
    },
    [profile.id],
  );

  useEffect(() => {
    refreshBattles();
  }, [refreshBattles]);

  const record = useMemo(
    () => battleRecord(myBattles, profile.id),
    [myBattles, profile.id],
  );

  useEffect(() => {
    fetchFollowCounts(profile.id).then(setFollowCounts);
  }, [profile.id, following]);

  const pinnedPost = useMemo(
    () => posts.find((p) => p.id === displayedProfile.pinnedPostId) ?? null,
    [posts, displayedProfile.pinnedPostId],
  );
  const unpinnedPosts = useMemo(
    () => (pinnedPost ? posts.filter((p) => p.id !== pinnedPost.id) : posts),
    [posts, pinnedPost],
  );

  const stats = useMemo(
    () => ({
      postCount: posts.length,
      totalLikes: posts.reduce((sum, p) => sum + p.likeCount, 0),
      preservedCount: posts.filter((p) => p.isPreserved).length,
    }),
    [posts],
  );

  async function handleShareProfile() {
    const url = `${window.location.origin}/u/${profile.handle}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: profile.displayName });
      } catch {
        // user cancelled the share sheet; nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("リンクをコピーしました");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  }

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
    if (
      !blocked &&
      !(await confirm({
        message: "このユーザーをブロックしますか？（相互フォローは解除されます）",
        confirmLabel: "ブロック",
        danger: true,
      }))
    ) {
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

  async function handleSaveBio(e: FormEvent) {
    e.preventDefault();
    if (savingBio) return;
    setSavingBio(true);
    try {
      await updateBio(bio);
      showToast("自己紹介を更新しました");
    } catch {
      showToast("更新に失敗しました", "error");
    } finally {
      setSavingBio(false);
    }
  }

  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setUploadingCover(true);
    try {
      const url = await uploadCoverImage(currentUserId, file);
      await updateCoverUrl(url);
      showToast("カバー画像を更新しました");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "アップロードに失敗しました", "error");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatarImage(currentUserId, file);
      await updateAvatarUrl(url);
      showToast("アイコンを更新しました");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "アップロードに失敗しました", "error");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleBattle() {
    if (!currentUserId || challenging) return;
    setChallenging(true);
    try {
      const battle = await createBattle(profile.id);
      setBattleResult(battle);
      refreshBattles();
    } catch {
      showToast("バトルの開始に失敗しました", "error");
    } finally {
      setChallenging(false);
    }
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelected(postId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (!currentUserId || selectedIds.size === 0 || bulkDeleting) return;
    if (
      !(await confirm({
        message: `選択した${selectedIds.size}件の投稿を削除しますか？`,
        confirmLabel: "削除",
        danger: true,
      }))
    )
      return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => deletePost(id, currentUserId)),
      );
      showToast("削除しました");
      setSelectMode(false);
      setSelectedIds(new Set());
      refresh();
    } catch {
      showToast("削除に失敗しました", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div>
      {displayedThemeColor && (
        <div className="h-2 w-full" style={{ backgroundColor: displayedThemeColor }} />
      )}
      <div className="relative h-32 w-full bg-black/5 dark:bg-white/10">
        {displayedProfile.coverUrl && (
          <Image
            src={displayedProfile.coverUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        )}
        {isOwnProfile && (
          <label className="absolute bottom-2 right-2 text-[10px] rounded-full bg-black/60 text-white px-2 py-1 cursor-pointer">
            {uploadingCover ? "アップロード中..." : "カバー画像を変更"}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              disabled={uploadingCover}
              className="hidden"
            />
          </label>
        )}
        <div className="absolute -bottom-8 left-4">
          <div className="relative">
            <Avatar
              name={displayedProfile.displayName}
              handle={profile.handle}
              avatarUrl={displayedProfile.avatarUrl}
              className="h-16 w-16 text-xl border-4 border-background"
            />
            {isOwnProfile && (
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-[9px] opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
                {uploadingAvatar ? "…" : "変更"}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 pt-10 border-b border-black/10 dark:border-white/10">
        {!isOwnProfile && blockedByThem && (
          <div className="mb-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
            このユーザーからブロックされています
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {isOwnProfile ? myProfile?.displayName ?? profile.displayName : profile.displayName}
            </h1>
            <p className="text-xs text-black/40 dark:text-white/40">
              @{profile.handle}
              <button
                onClick={handleShareProfile}
                aria-label="プロフィールを共有"
                className="ml-1.5 hover:underline"
              >
                ↗️
              </button>
            </p>
            {!isOwnProfile && displayedProfile.bio && (
              <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                {displayedProfile.bio}
              </p>
            )}
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
              <button
                onClick={handleBattle}
                disabled={challenging}
                className="text-xs rounded-full border border-amber-400 text-amber-600 dark:text-amber-300 px-2 py-1 disabled:opacity-40"
              >
                {challenging ? "対戦中..." : "⚔️ バトル"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-4 text-xs text-black/60 dark:text-white/60">
          <span>投稿 {stats.postCount}</span>
          <span>累計いいね {stats.totalLikes}</span>
          <span>🏆殿堂入り {stats.preservedCount}</span>
          {(record.wins > 0 || record.losses > 0 || record.draws > 0) && (
            <span>
              ⚔️ {record.wins}勝{record.losses}敗{record.draws > 0 ? `${record.draws}分` : ""}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex gap-4 text-xs">
          <Link href={`/u/${profile.handle}/follows/following`} className="hover:underline">
            <span className="font-semibold">{followCounts.following}</span>{" "}
            <span className="text-black/50 dark:text-white/50">フォロー中</span>
          </Link>
          <Link href={`/u/${profile.handle}/follows/followers`} className="hover:underline">
            <span className="font-semibold">{followCounts.followers}</span>{" "}
            <span className="text-black/50 dark:text-white/50">フォロワー</span>
          </Link>
          {isOwnProfile && (
            <Link href="/likes" className="text-black/50 dark:text-white/50 hover:underline">
              いいね一覧
            </Link>
          )}
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
            <form onSubmit={handleSaveBio} className="mt-2 flex flex-col gap-1.5">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="自己紹介（160文字まで）"
                rows={2}
                maxLength={160}
                className="resize-none rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
              />
              <button
                type="submit"
                disabled={savingBio}
                className="self-end text-xs rounded-full bg-foreground text-background px-3 py-1 disabled:opacity-40"
              >
                自己紹介を保存
              </button>
            </form>
          </>
        )}
      </div>

      {isOwnProfile && posts.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10 dark:border-white/10">
          <button
            onClick={toggleSelectMode}
            className="text-xs text-blue-500 hover:underline"
          >
            {selectMode ? "キャンセル" : "選択"}
          </button>
          {selectMode && (
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="text-xs text-red-500 hover:underline disabled:opacity-40"
            >
              選択した{selectedIds.size}件を削除
            </button>
          )}
        </div>
      )}
      {pinnedPost && (
        <div className="border-b border-black/10 dark:border-white/10">
          <p className="px-4 pt-2 text-[10px] text-amber-600 dark:text-amber-300">
            📌 固定表示中
          </p>
          <PostCard
            post={pinnedPost}
            currentUserId={currentUserId}
            isFollowing={following}
            onDeleted={refresh}
          />
        </div>
      )}
      {loading ? (
        <PostListSkeleton />
      ) : posts.length === 0 ? (
        <p className="p-4 text-sm text-black/50 dark:text-white/50">
          まだ投稿がありません。
        </p>
      ) : (
        unpinnedPosts.map((post) => (
          <div key={post.id} className="flex items-start">
            {selectMode && (
              <label className="flex items-center pl-4 pt-4 shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(post.id)}
                  onChange={() => toggleSelected(post.id)}
                  aria-label="投稿を選択"
                />
              </label>
            )}
            <div className="flex-1 min-w-0">
              <PostCard
                post={post}
                currentUserId={currentUserId}
                isFollowing={following}
                onDeleted={refresh}
              />
            </div>
          </div>
        ))
      )}
      {battleResult && currentUserId && (
        <BattleResultModal
          battle={battleResult}
          challengerName={myProfile?.displayName ?? "あなた"}
          opponentName={profile.displayName}
          viewerIsChallenger={battleResult.challengerId === currentUserId}
          onClose={() => setBattleResult(null)}
        />
      )}
    </div>
  );
}
