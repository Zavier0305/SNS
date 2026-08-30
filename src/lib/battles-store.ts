"use client";

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type BattleRow = Database["public"]["Tables"]["sns_battles"]["Row"];

export type Battle = {
  id: string;
  challengerId: string;
  opponentId: string;
  challengerPosts: number;
  challengerLikes: number;
  challengerFollowers: number;
  opponentPosts: number;
  opponentLikes: number;
  opponentFollowers: number;
  challengerRoundWins: number;
  opponentRoundWins: number;
  winnerId: string | null;
  createdAt: string;
};

function toBattle(row: BattleRow): Battle {
  return {
    id: row.id,
    challengerId: row.challenger_id,
    opponentId: row.opponent_id,
    challengerPosts: row.challenger_posts,
    challengerLikes: row.challenger_likes,
    challengerFollowers: row.challenger_followers,
    opponentPosts: row.opponent_posts,
    opponentLikes: row.opponent_likes,
    opponentFollowers: row.opponent_followers,
    challengerRoundWins: row.challenger_round_wins,
    opponentRoundWins: row.opponent_round_wins,
    winnerId: row.winner_id,
    createdAt: row.created_at,
  };
}

export async function createBattle(opponentId: string): Promise<Battle> {
  const { data, error } = await supabase.rpc("sns_create_battle", {
    p_opponent_id: opponentId,
  });
  if (error || !data) throw error ?? new Error("バトルの作成に失敗しました");
  return toBattle(data as BattleRow);
}

export async function fetchMyBattles(userId: string): Promise<Battle[]> {
  const { data } = await supabase
    .from("sns_battles")
    .select("*")
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(toBattle);
}

export function battleRecord(battles: Battle[], userId: string) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const b of battles) {
    if (b.winnerId === null) draws += 1;
    else if (b.winnerId === userId) wins += 1;
    else losses += 1;
  }
  return { wins, losses, draws };
}
