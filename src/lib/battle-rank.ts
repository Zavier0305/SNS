export type BattleTier = {
  name: string;
  emoji: string;
  minRating: number;
};

const TIERS: BattleTier[] = [
  { name: "ブロンズ", emoji: "🥉", minRating: 0 },
  { name: "シルバー", emoji: "🥈", minRating: 1100 },
  { name: "ゴールド", emoji: "🥇", minRating: 1300 },
  { name: "プラチナ", emoji: "💎", minRating: 1500 },
  { name: "ダイヤモンド", emoji: "👑", minRating: 1800 },
];

export function tierForRating(rating: number): BattleTier {
  let result = TIERS[0];
  for (const tier of TIERS) {
    if (rating >= tier.minRating) result = tier;
  }
  return result;
}
