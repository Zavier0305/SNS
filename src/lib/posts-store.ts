"use client";

import { useSyncExternalStore } from "react";
import type { Post } from "./types";

const STORAGE_KEY = "sns.posts";
const CHANGE_EVENT = "sns-posts-updated";

let cachedRaw: string | null = null;
let cachedPosts: Post[] = [];

function getSnapshot(): Post[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedPosts = raw ? (JSON.parse(raw) as Post[]) : [];
    } catch {
      cachedPosts = [];
    }
  }
  return cachedPosts;
}

const EMPTY_POSTS: Post[] = [];

function getServerSnapshot(): Post[] {
  return EMPTY_POSTS;
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function addPost(authorName: string, content: string) {
  const posts = getSnapshot();
  const newPost: Post = {
    id: crypto.randomUUID(),
    authorName,
    content,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newPost, ...posts]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePosts(): Post[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
