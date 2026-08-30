import { describe, expect, it, vi, afterEach } from "vitest";
import { hotScore } from "./posts-store";

describe("hotScore", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives comments twice the weight of likes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const createdAt = now.toISOString();
    const likesOnly = hotScore(2, 0, createdAt);
    const commentsOnly = hotScore(0, 1, createdAt);
    expect(commentsOnly).toBeCloseTo(likesOnly);
  });

  it("decays as the post gets older", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fresh = hotScore(10, 5, now.toISOString());
    const old = hotScore(10, 5, new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString());
    expect(old).toBeLessThan(fresh);
  });

  it("never produces a negative score for future timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    expect(hotScore(5, 5, future)).toBeGreaterThan(0);
  });
});
