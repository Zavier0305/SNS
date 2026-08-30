import { describe, expect, it } from "vitest";
import { tierForRating } from "./battle-rank";

describe("tierForRating", () => {
  it("returns bronze below the first threshold", () => {
    expect(tierForRating(0).name).toBe("ブロンズ");
    expect(tierForRating(1099).name).toBe("ブロンズ");
  });

  it("returns the exact tier at a threshold boundary", () => {
    expect(tierForRating(1100).name).toBe("シルバー");
    expect(tierForRating(1300).name).toBe("ゴールド");
    expect(tierForRating(1500).name).toBe("プラチナ");
    expect(tierForRating(1800).name).toBe("ダイヤモンド");
  });

  it("returns the highest tier for very high ratings", () => {
    expect(tierForRating(3000).name).toBe("ダイヤモンド");
  });
});
