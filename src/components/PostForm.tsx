"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { addPost, MAX_IMAGE_BYTES, MAX_IMAGES_PER_POST } from "@/lib/posts-store";
import { useToast } from "@/lib/toast-context";
import type { Post } from "@/lib/types";

const MAX_POLL_OPTIONS = 4;
const MAX_CONTENT_LENGTH = 280;

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
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (quotedPost) return;
    const draft = localStorage.getItem(draftKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (draft) setContent(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

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
        },
      );
      setContent("");
      localStorage.removeItem(draftKey);
      clearImages();
      setPollOptions(null);
      showToast("投稿しました");
      onCancelQuote?.();
      onPosted?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "投稿に失敗しました", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 p-4 border-b border-black/10 dark:border-white/10"
    >
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
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={3}
        maxLength={MAX_CONTENT_LENGTH}
        className="resize-none rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
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
        <div className="flex items-center gap-3">
          <label className="text-xs text-black/60 dark:text-white/60 cursor-pointer hover:underline">
            画像を追加（最大{MAX_IMAGES_PER_POST}枚）
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
              className="text-xs text-black/60 dark:text-white/60 hover:underline"
            >
              投票を追加
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="rounded-full bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {submitting ? "投稿中..." : "投稿する"}
        </button>
      </div>
    </form>
  );
}
