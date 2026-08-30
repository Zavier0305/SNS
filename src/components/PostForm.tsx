"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { addPost, MAX_IMAGE_BYTES, MAX_IMAGES_PER_POST } from "@/lib/posts-store";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { ImageIcon, PollIcon, WarningIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import type { Post } from "@/lib/types";

const MAX_POLL_OPTIONS = 4;
const MAX_CONTENT_LENGTH = 280;
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

type ImageEntry = { file: File; previewUrl: string };

export function PostForm({
  authorId,
  onPosted,
  quotedPost,
  onCancelQuote,
  channelId,
}: {
  authorId: string;
  onPosted?: () => void;
  quotedPost?: Post | null;
  onCancelQuote?: () => void;
  channelId?: string | null;
}) {
  const draftKey = `sns.draft.${channelId ?? "global"}`;
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  const [isSensitive, setIsSensitive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [expanded, setExpanded] = useState(!!quotedPost);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();
  const { profile } = useAuth();
  const rateLimitKey = `sns.postTimestamps.${authorId}`;

  function recordPostTimestamp() {
    const now = Date.now();
    const recent = getRecentTimestamps().filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    recent.push(now);
    localStorage.setItem(rateLimitKey, JSON.stringify(recent));
  }

  function getRecentTimestamps(): number[] {
    try {
      const raw = localStorage.getItem(rateLimitKey);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const recent = getRecentTimestamps().filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (recent.length >= RATE_LIMIT_COUNT) {
        const oldest = Math.min(...recent);
        setCooldownSeconds(Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
      } else {
        setCooldownSeconds(0);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId]);

  useEffect(() => {
    if (quotedPost) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(true);
      return;
    }
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      setContent(draft);
      setExpanded(true);
    }
  }, [draftKey, quotedPost]);

  useEffect(() => {
    if (content) {
      localStorage.setItem(draftKey, content);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [content, draftKey]);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES_PER_POST) {
      showToast(`画像は最大${MAX_IMAGES_PER_POST}枚までです`, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const oversized = files.find((f) => f.size > MAX_IMAGE_BYTES);
    if (oversized) {
      showToast("画像は5MB以下にしてください", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImages((current) => [
      ...current,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  function clearImages() {
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updatePollOption(index: number, value: string) {
    setPollOptions((current) => {
      if (!current) return current;
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  const validPollOptions = pollOptions?.map((o) => o.trim()).filter(Boolean) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    if (pollOptions && validPollOptions.length < 2) {
      showToast("投票の選択肢は2つ以上入力してください", "error");
      return;
    }
    setSubmitting(true);
    try {
      await addPost(
        authorId,
        trimmed,
        images.map((i) => i.file),
        {
          quotedPostId: quotedPost?.id ?? null,
          pollOptions: pollOptions ? validPollOptions : null,
          channelId: channelId ?? null,
          isSensitive,
        },
      );
      recordPostTimestamp();
      setContent("");
      localStorage.removeItem(draftKey);
      clearImages();
      setPollOptions(null);
      setIsSensitive(false);
      setExpanded(false);
      showToast("投稿しました");
      onCancelQuote?.();
      onPosted?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "投稿に失敗しました", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
        className="flex w-full items-center gap-3 mx-2 sm:mx-3 mb-3 p-3 rounded-2xl border border-black/10 dark:border-white/10 bg-background text-left shadow-sm hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors"
      >
        <Avatar
          name={profile?.displayName ?? ""}
          handle={profile?.handle ?? ""}
          avatarUrl={profile?.avatarUrl}
          className="h-9 w-9 text-sm"
          ring
        />
        <span className="text-sm text-black/40 dark:text-white/40">いまどうしてる？</span>
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 mx-2 sm:mx-3 mb-3 p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-background shadow-sm"
    >
      {!quotedPost && !content && images.length === 0 && !pollOptions && (
        <div className="flex justify-end -mt-1 -mr-1">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="閉じる"
            className="text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white text-sm px-1"
          >
            ×
          </button>
        </div>
      )}
      {quotedPost && (
        <div className="flex items-start justify-between rounded-md border border-black/10 dark:border-white/10 p-2 text-xs">
          <div>
            <span className="font-semibold">{quotedPost.authorDisplayName}</span>
            <p className="mt-0.5 text-black/60 dark:text-white/60 line-clamp-2">
              {quotedPost.content}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelQuote}
            className="text-black/40 dark:text-white/40 shrink-0 ml-2"
          >
            ×
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="いまどうしてる？（Ctrl/Cmd+Enterで投稿）"
        rows={3}
        maxLength={MAX_CONTENT_LENGTH}
        className="resize-none rounded-2xl border border-black/10 dark:border-white/20 bg-black/[0.02] dark:bg-white/[0.03] p-3 text-sm outline-none focus:border-accent/50"
      />
      <span
        className={`self-end text-[10px] ${
          MAX_CONTENT_LENGTH - content.length <= 20
            ? "text-red-500"
            : "text-black/40 dark:text-white/40"
        }`}
      >
        {content.length}/{MAX_CONTENT_LENGTH}
      </span>
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt=""
                className="max-h-28 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white text-xs w-5 h-5 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {pollOptions && (
        <div className="flex flex-col gap-1.5">
          {pollOptions.map((option, i) => (
            <input
              key={i}
              value={option}
              onChange={(e) => updatePollOption(i, e.target.value)}
              placeholder={`選択肢${i + 1}`}
              maxLength={40}
              className="rounded-md border border-black/10 dark:border-white/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-black/30 dark:focus:border-white/40"
            />
          ))}
          <div className="flex items-center gap-2">
            {pollOptions.length < MAX_POLL_OPTIONS && (
              <button
                type="button"
                onClick={() => setPollOptions((c) => [...(c ?? []), ""])}
                className="text-xs text-black/60 dark:text-white/60 hover:underline"
              >
                + 選択肢を追加
              </button>
            )}
            <button
              type="button"
              onClick={() => setPollOptions(null)}
              className="text-xs text-black/40 dark:text-white/40 hover:underline"
            >
              投票を削除
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label
            aria-label={`画像を追加（最大${MAX_IMAGES_PER_POST}枚）`}
            className="flex items-center justify-center h-8 w-8 rounded-full text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <ImageIcon className="h-[18px] w-[18px]" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
          {!pollOptions && (
            <button
              type="button"
              onClick={() => setPollOptions(["", ""])}
              aria-label="投票を追加"
              className="flex items-center justify-center h-8 w-8 rounded-full text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <PollIcon className="h-[18px] w-[18px]" />
            </button>
          )}
          <label
            aria-label="閲覧注意として投稿"
            className={`flex items-center justify-center h-8 w-8 rounded-full cursor-pointer ${
              isSensitive
                ? "text-amber-600 dark:text-amber-300 bg-amber-500/10"
                : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
              className="hidden"
            />
            <WarningIcon className="h-[18px] w-[18px]" />
          </label>
        </div>
        <div className="flex items-center gap-2">
          {cooldownSeconds > 0 && (
            <span className="text-[10px] text-black/40 dark:text-white/40">
              あと{cooldownSeconds}秒で投稿できます
            </span>
          )}
          <button
            type="submit"
            disabled={!content.trim() || submitting || cooldownSeconds > 0}
            className="accent-pill px-4 py-1.5 text-sm font-semibold disabled:opacity-40 transition active:scale-95"
          >
            {submitting ? "投稿中..." : "投稿する"}
          </button>
        </div>
      </div>
    </form>
  );
}
