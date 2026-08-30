"use client";

import { useEffect } from "react";
import Image from "next/image";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="画像を拡大表示"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="relative w-full max-w-2xl h-[80vh]">
        <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" />
      </div>
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-4 right-4 text-white text-2xl leading-none"
      >
        ×
      </button>
    </div>
  );
}
