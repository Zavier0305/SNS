"use client";

import { supabase } from "@/lib/supabase/client";

export async function fetchMuteWords(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("sns_mute_words")
    .select("word")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.word);
}

export async function addMuteWord(userId: string, word: string) {
  const trimmed = word.trim().toLowerCase();
  if (!trimmed) return;
  const { error } = await supabase
    .from("sns_mute_words")
    .insert({ user_id: userId, word: trimmed });
  if (error) throw error;
}

export async function removeMuteWord(userId: string, word: string) {
  const { error } = await supabase
    .from("sns_mute_words")
    .delete()
    .eq("user_id", userId)
    .eq("word", word);
  if (error) throw error;
}

export function postMatchesMuteWords(content: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const lower = content.toLowerCase();
  return words.some((w) => lower.includes(w));
}
