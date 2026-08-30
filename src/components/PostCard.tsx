"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useEffect, useState } from "react";
import type { Post } from "@/lib/types";
import { deletePost, toggleFollow, toggleLike, updatePost } from "@/lib/posts-store";
import { togglePin } from "@/lib/servers-store";
import { toggleBookmark, useIsBookmarked } from "@/lib/bookmarks-store";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { supabase } from "@/lib/supabase/client";
import { CommentSection } from "@/components/CommentSection";
import { PollWidget } from "@/components/PollWidget";
import { PostMenu } from "@/components/PostMenu";
import { ReactionBar } from "@/components/ReactionBar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { LikersModal } from "@/components/LikersModal";
import { formatRelativeTime } from "@/lib/format-time";
import {
  HeartIcon,
  CommentIcon,
  RepostIcon,
  BookmarkIcon,
  BookmarkFilledIcon,
  ShareIcon,
  PinIcon,
} from "@/components/icons";

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function remainingDays(expireAt: string): number {
  const ms = new Date(expireAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

const HASHTAG_PATTERN = /#([\w぀-ヿ一-鿿]+)/g;
const URL_PATTERN = /https?:\/\/[^\s]+/g;

function extractLinks(content: string): string[] {
  const matches = content.match(URL_PATTERN) ?? [];
  return [...new Set(matches)].slice(0, 3);
}

function LinkPreviewCard({ url }: { url: string }) {
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // keep raw url as fallback label
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-2 flex items-center gap-2 rounded-md border border-black/10 dark:border-white/10 p-2 text-xs hover:bg-black/5 dark:hover:bg-white/10"
    >
      <span aria-hidden="true">🔗</span>
      <span className="truncate text-blue-500">{hostname}</span>
    </a>
  );
}

function renderContent(content: string) {
  const parts = content.split(HASHTAG_PATTERN);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Link
        key={i}
        href={`/tag/${part.toLowerCase()}`}
        className="text-blue-500 hover:underline"
      >
        #{part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function PostCard({
  post,
  currentUserId,
  isFollowing,
  onFollowChange,
  onDeleted,
  onQuote,
  canModerate,
  onPinChange,
}: {
  post: Post;
  currentUserId: string | null;
  isFollowing: boolean;
  onFollowChange?: () => void;
  onDeleted?: () => void;
  onQuote?: (post: Post) => void;
  canModerate?: boolean;
  onPinChange?: () => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [following, setFollowing] = useState(isFollowing);
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [content, setContentState] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [editSensitive, setEditSensitive] = useState(post.isSensitive);
  const [sensitive, setSensitive] = useState(post.isSensitive);
  const [revealed, setRevealed] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const { profile: myProfile, updatePinnedPost } = useAuth();
  const [pinningProfile, setPinningProfile] = useState(false);
  const [showOwnMenu, setShowOwnMenu] = useState(false);
  const { showToast } = useToast();
  const { bookmarked, refresh: refreshBookmark } = useIsBookmarked(post.id, currentUserId);
  const isOwnPost = currentUserId === post.authorId;
  const days = remainingDays(post.expireAt);

  useEffect(() => {
    const channel = supabase
      .channel(`sns_post_counts_${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sns_likes", filter: `post_id=eq.${post.id}` },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new.user_id !== currentUserId) {
            setLikeCount((c) => c + 1);
          } else if (payload.eventType === "DELETE" && payload.old.user_id !== currentUserId) {
            setLikeCount((c) => Math.max(0, c - 1));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sns_comments", filter: `post_id=eq.${post.id}` },
        (payload) => {
          if (payload.new.author_id !== currentUserId) {
            setCommentCount((c) => c + 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function handleBookmark() {
    if (!currentUserId) return;
    try {
      await toggleBookmark(post.id, currentUserId, bookmarked);
      refreshBookmark();
    } catch {
      showToast("操作に失敗しました", "error");
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, text: post.content });
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

  async function handleSaveEdit() {
    if (!currentUserId || !editContent.trim() || saving) return;
    setSaving(true);
    try {
      await updatePost(post.id, currentUserId, editContent.trim(), editSensitive);
      setContentState(editContent.trim());
      setSensitive(editSensitive);
      setEditing(false);
      showToast("編集しました");
    } catch {
      showToast("編集に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleProfilePin() {
    if (!isOwnPost || pinningProfile) return;
    const isPinnedToProfile = myProfile?.pinnedPostId === post.id;
    setPinningProfile(true);
    try {
      await updatePinnedPost(isPinnedToProfile ? null : post.id);
      showToast(isPinnedToProfile ? "固定を解除しました" : "プロフィールに固定しました");
    } catch {
      showToast("操作に失敗しました", "error");
    } finally {
      setPinningProfile(false);
    }
  }

  async function handlePin() {
    try {
      await togglePin(post.id, post.isPinned);
      onPinChange?.();
    } catch {
      showToast("ピン留めの変更に失敗しました", "error");
    }
  }

  async function handleLike() {
    if (!currentUserId) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => count + (nextLiked ? 1 : -1));
    try {
      await toggleLike(post.id, currentUserId, liked);
    } catch {
      setLiked(liked);
      setLikeCount(post.likeCount);
    }
  }

  async function handleFollow() {
    if (!currentUserId || isOwnPost) return;
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    try {
      await toggleFollow(post.authorId, currentUserId, following);
      onFollowChange?.();
    } catch {
      setFollowing(following);
    }
  }

  async function handleDelete() {
    if (!currentUserId || deleting) return;
    if (!confirm("この投稿を削除しますか？")) return;
    setDeleting(true);
    try {
      await deletePost(post.id, currentUserId);
      showToast("投稿を削除しました");
      onDeleted?.();
    } catch {
      showToast("削除に失敗しました", "error");
      setDeleting(false);
    }
  }

  if (hidden) return null;

  return (
    <article className="p-4 border-b border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <Link
            href={`/u/${post.authorHandle}`}
            className="font-semibold text-sm truncate hover:underline"
          >
            {post.authorDisplayName}
          </Link>
          <span className="text-xs text-black/40 dark:text-white/40 truncate">
            @{post.authorHandle}
          </span>
          <Link
            href={`/post/${post.id}`}
            title={formatTime(post.createdAt)}
            className="text-xs text-black/50 dark:text-white/50 shrink-0 hover:underline"
          >
            {formatRelativeTime(post.createdAt)}
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canModerate && (
            <button
              onClick={handlePin}
              aria-label={post.isPinned ? "ピン留めを解除" : "ピン留めする"}
              aria-pressed={post.isPinned}
              className={`flex items-center rounded-full border px-1.5 py-1 ${
                post.isPinned
                  ? "border-amber-400 text-amber-600 dark:text-amber-300"
                  : "border-black/20 dark:border-white/20"
              }`}
            >
              <PinIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {!isOwnPost && currentUserId && (
            <button
              onClick={handleFollow}
              className="text-xs rounded-full border border-black/20 dark:border-white/20 px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {following ? "フォロー中" : "フォロー"}
            </button>
          )}
          {isOwnPost ? (
            <div className="relative">
              <button
                onClick={() => setShowOwnMenu((v) => !v)}
                aria-label="投稿メニュー"
                aria-expanded={showOwnMenu}
                className="text-xs text-black/40 dark:text-white/40 px-1"
              >
                ⋯
              </button>
              {showOwnMenu && (
                <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-black/10 dark:border-white/20 bg-background shadow-lg text-xs overflow-hidden">
                  {!post.channelId && (
                    <button
                      onClick={() => {
                        handleProfilePin();
                        setShowOwnMenu(false);
                      }}
                      disabled={pinningProfile}
                      className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      {myProfile?.pinnedPostId === post.id ? "固定を解除" : "プロフィールに固定"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditContent(content);
                      setEditSensitive(sensitive);
                      setEditing(true);
                      setShowOwnMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => {
                      setShowOwnMenu(false);
                      handleDelete();
                    }}
                    disabled={deleting}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-red-500"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ) : (
            currentUserId && (
              <PostMenu
                postId={post.id}
                authorId={post.authorId}
                currentUserId={currentUserId}
                onHidden={() => setHidden(true)}
              />
            )
          )}
        </div>
      </div>

      <div className="mt-1 flex gap-1.5">
        {post.isPinned && (
          <span className="flex items-center gap-1 text-[10px] rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5">
            <PinIcon className="h-2.5 w-2.5" />
            ピン留め中
          </span>
        )}
        {post.isPreserved ? (
          <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5">
            🏆 殿堂入り
          </span>
        ) : post.isHidden ? (
          <span className="text-[10px] rounded-full bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 px-2 py-0.5">
            消滅済み（自分のみ表示中）
          </span>
        ) : (
          <span className="text-[10px] rounded-full bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 px-2 py-0.5">
            あと{days}日で消滅
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSaveEdit();
              }
            }}
            rows={3}
            maxLength={280}
            className="resize-none rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
            <input
              type="checkbox"
              checked={editSensitive}
              onChange={(e) => setEditSensitive(e.target.checked)}
            />
            閲覧注意（内容をぼかして表示）
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-black/50 dark:text-white/50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editContent.trim()}
              className="text-xs rounded-full bg-foreground text-background px-3 py-1 disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      ) : sensitive && !revealed ? (
        <div className="relative mt-1 rounded-md border border-black/10 dark:border-white/10 p-4 text-center">
          <p className="text-sm text-black/50 dark:text-white/50 blur-sm select-none">
            {content || "画像"}
          </p>
          <button
            onClick={() => setRevealed(true)}
            className="absolute inset-0 flex items-center justify-center text-xs font-medium bg-background/70"
          >
            ⚠️ 閲覧注意 - タップして表示
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">
          {renderContent(content)}
        </p>
      )}
      {!editing &&
        (!sensitive || revealed) &&
        extractLinks(content).map((url) => <LinkPreviewCard key={url} url={url} />)}
      {post.imageUrls.length > 0 && (!sensitive || revealed) && (
        <div
          className={`mt-2 grid gap-1 ${
            post.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {post.imageUrls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxUrl(url)}
              className="relative h-60 w-full"
              aria-label="画像を拡大表示"
            >
              <Image
                src={url}
                alt={`${post.authorDisplayName}の投稿画像 ${i + 1}`}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 100vw, 576px"
                className="rounded-lg object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {lightboxUrl && (
        <ImageLightbox
          src={lightboxUrl}
          alt={`${post.authorDisplayName}の投稿画像`}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      {post.pollOptions && (
        <PollWidget
          postId={post.id}
          options={post.pollOptions}
          myVote={post.myPollVote}
          currentUserId={currentUserId}
        />
      )}

      {post.quotedPostId && (
        <div className="mt-2 rounded-md border border-black/10 dark:border-white/10 p-2 text-xs">
          <span className="font-semibold">{post.quotedAuthorDisplayName}</span>
          <span className="text-black/40 dark:text-white/40 ml-1">
            @{post.quotedAuthorHandle}
          </span>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-black/70 dark:text-white/70">
            {post.quotedContent ?? "（元の投稿は削除されました）"}
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between max-w-md">
        <span className="flex items-center gap-1.5">
          <button
            onClick={handleLike}
            disabled={!currentUserId}
            aria-label={liked ? "いいねを取り消す" : "いいねする"}
            aria-pressed={liked}
            className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
              liked
                ? "text-pink-500"
                : "text-black/50 dark:text-white/50 hover:bg-pink-500/10 hover:text-pink-500"
            }`}
          >
            <HeartIcon filled={liked} className="h-[18px] w-[18px]" />
          </button>
          {likeCount > 0 ? (
            <button
              onClick={() => setShowLikers(true)}
              className="text-xs text-black/50 dark:text-white/50 hover:underline"
            >
              {likeCount}
            </button>
          ) : (
            <span className="text-xs text-black/50 dark:text-white/50">{likeCount}</span>
          )}
        </span>
        <button
          onClick={() => setShowComments((v) => !v)}
          aria-label="コメントを表示"
          aria-expanded={showComments}
          className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50"
        >
          <span className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors">
            <CommentIcon className="h-[18px] w-[18px]" />
          </span>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
        {onQuote && currentUserId && (
          <button
            onClick={() => onQuote(post)}
            aria-label="引用して投稿"
            className="flex items-center justify-center h-8 w-8 rounded-full text-black/50 dark:text-white/50 hover:bg-green-500/10 hover:text-green-500 transition-colors"
          >
            <RepostIcon className="h-[18px] w-[18px]" />
          </button>
        )}
        {currentUserId && (
          <button
            onClick={handleBookmark}
            aria-label={bookmarked ? "ブックマークを解除" : "ブックマークする"}
            aria-pressed={bookmarked}
            className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
              bookmarked
                ? "text-blue-500"
                : "text-black/50 dark:text-white/50 hover:bg-blue-500/10 hover:text-blue-500"
            }`}
          >
            {bookmarked ? (
              <BookmarkFilledIcon className="h-[18px] w-[18px]" />
            ) : (
              <BookmarkIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
        <button
          onClick={handleShare}
          aria-label="共有する"
          className="flex items-center justify-center h-8 w-8 rounded-full text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <ShareIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
      <ReactionBar postId={post.id} currentUserId={currentUserId} />
      {showLikers && <LikersModal postId={post.id} onClose={() => setShowLikers(false)} />}
      {showComments && (
        <CommentSection
          postId={post.id}
          currentUserId={currentUserId}
          onCommentCountChange={(delta) =>
            setCommentCount((count) => count + delta)
          }
        />
      )}
    </article>
  );
}
