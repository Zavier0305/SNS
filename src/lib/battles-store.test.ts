import { describe, expect, it } from "vitest";
import { battleRecord, type Battle } from "./battles-store";

function makeBattle(overrides: Partial<Battle>): Battle {
  return {
    id: "b1",
    challengerId: "u1",
    opponentId: "u2",
    challengerPosts: 0,
    challengerLikes: 0,
    challengerFollowers: 0,
    opponentPosts: 0,
    opponentLikes: 0,
    opponentFollowers: 0,
    challengerRoundWins: 0,
    opponentRoundWins: 0,
    winnerId: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("battleRecord", () => {
  it("counts wins, losses, and draws for a user", () => {
    const battles = [
      makeBattle({ winnerId: "u1" }),
      makeBattle({ winnerId: "u2" }),
      makeBattle({ winnerId: null }),
      makeBattle({ winnerId: "u1" }),
    ];
    expect(battleRecord(battles, "u1")).toEqual({ wins: 2, losses: 1, draws: 1 });
  });

  it("returns all zeros for no battles", () => {
    expect(battleRecord([], "u1")).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it("counts a win for the other participant as a loss", () => {
    const battles = [makeBattle({ challengerId: "u1", opponentId: "u2", winnerId: "u2" })];
    expect(battleRecord(battles, "u1")).toEqual({ wins: 0, losses: 1, draws: 0 });
  });
});
