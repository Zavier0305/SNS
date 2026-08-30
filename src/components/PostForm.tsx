"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { addPost } from "@/lib/posts-store";

export function PostForm({
  authorId,
  onPosted,
}: {
  authorId: string;
  onPosted?: () => void;
}) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await addPost(authorId, trimmed, imageFile);
      setContent("");
      clearImage();
      onPosted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 p-4 border-b border-black/10 dark:border-white/10"
    >
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
      <div className="flex items-center justify-between">
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
