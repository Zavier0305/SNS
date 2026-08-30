"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { Post } from "@/lib/types";
import { deletePost, toggleFollow, toggleLike } from "@/lib/posts-store";
import { useToast } from "@/lib/toast-context";
import { CommentSection } from "@/components/CommentSection";
import { PollWidget } from "@/components/PollWidget";
import { PostMenu } from "@/components/PostMenu";

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
}: {
  post: Post;
  currentUserId: string | null;
  isFollowing: boolean;
  onFollowChange?: () => void;
  onDeleted?: () => void;
  onQuote?: (post: Post) => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [following, setFollowing] = useState(isFollowing);
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { showToast } = useToast();
  const isOwnPost = currentUserId === post.authorId;
  const days = remainingDays(post.expireAt);

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
          <span className="text-xs text-black/50 dark:text-white/50 shrink-0">
            {formatTime(post.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOwnPost && currentUserId && (
            <button
              onClick={handleFollow}
              className="text-xs rounded-full border border-black/20 dark:border-white/20 px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {following ? "フォロー中" : "フォロー"}
            </button>
          )}
          {isOwnPost ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-black/40 dark:text-white/40 hover:text-red-500"
            >
              削除
            </button>
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

      <p className="mt-1 text-sm whitespace-pre-wrap break-words">
        {renderContent(post.content)}
      </p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="mt-2 rounded-lg max-h-80 w-auto object-cover"
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

      <div className="mt-2 flex items-center gap-4">
        <button
          onClick={handleLike}
          disabled={!currentUserId}
          className={`flex items-center gap-1 text-xs ${
            liked ? "text-pink-500" : "text-black/50 dark:text-white/50"
          }`}
        >
          <span>{liked ? "♥" : "♡"}</span>
          <span>{likeCount}</span>
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1 text-xs text-black/50 dark:text-white/50"
        >
          <span>💬</span>
          <span>{commentCount}</span>
        </button>
        {onQuote && currentUserId && (
          <button
            onClick={() => onQuote(post)}
            className="flex items-center gap-1 text-xs text-black/50 dark:text-white/50"
          >
            <span>❝</span>
            <span>引用</span>
          </button>
        )}
      </div>
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
