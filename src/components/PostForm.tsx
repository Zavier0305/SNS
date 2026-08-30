"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { addPost, MAX_IMAGE_BYTES } from "@/lib/posts-store";
import { useToast } from "@/lib/toast-context";
import type { Post } from "@/lib/types";

const MAX_POLL_OPTIONS = 4;

export function PostForm({
  authorId,
  onPosted,
  quotedPost,
  onCancelQuote,
}: {
  authorId: string;
  onPosted?: () => void;
  quotedPost?: Post | null;
  onCancelQuote?: () => void;
}) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_IMAGE_BYTES) {
      showToast("画像は5MB以下にしてください", "error");
      clearImage();
      return;
    }
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
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
      await addPost(authorId, trimmed, imageFile, {
        quotedPostId: quotedPost?.id ?? null,
        pollOptions: pollOptions ? validPollOptions : null,
      });
      setContent("");
      clearImage();
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
        maxLength={280}
        className="resize-none rounded-md border border-black/10 dark:border-white/20 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
      />
      {imagePreview && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt=""
            className="max-h-40 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white text-xs w-5 h-5 flex items-center justify-center"
          >
            ×
          </button>
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
            画像を追加
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
