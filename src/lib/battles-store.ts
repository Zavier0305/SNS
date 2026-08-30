"use client";

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type BattleRow = Database["public"]["Tables"]["sns_battles"]["Row"];
type BattleRatingRow = Database["public"]["Tables"]["sns_battle_ratings"]["Row"];
type PeriodRankingRow =
  Database["public"]["Functions"]["sns_battle_period_ranking"]["Returns"][number];

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

export type BattleRating = {
  userId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: string;
};

function toBattleRating(row: BattleRatingRow): BattleRating {
  return {
    userId: row.user_id,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    updatedAt: row.updated_at,
  };
}

export async function fetchMyRating(userId: string): Promise<BattleRating | null> {
  const { data } = await supabase
    .from("sns_battle_ratings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? toBattleRating(data) : null;
}

export async function fetchTopRatings(limit = 20): Promise<BattleRating[]> {
  const { data } = await supabase
    .from("sns_battle_ratings")
    .select("*")
    .order("rating", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toBattleRating);
}

export type PeriodRankingEntry = {
  userId: string;
  wins: number;
  losses: number;
  draws: number;
  battleCount: number;
};

function toPeriodRankingEntry(row: PeriodRankingRow): PeriodRankingEntry {
  return {
    userId: row.user_id,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    battleCount: row.battle_count,
  };
}

export async function fetchPeriodRanking(
  period: "week" | "month",
): Promise<PeriodRankingEntry[]> {
  const { data } = await supabase.rpc("sns_battle_period_ranking", { p_period: period });
  return (data ?? []).map(toPeriodRankingEntry);
}
