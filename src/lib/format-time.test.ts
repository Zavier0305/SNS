import { describe, expect, it, vi, afterEach } from "vitest";
import { formatRelativeTime } from "./format-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns たった今 for under a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatRelativeTime(new Date(now.getTime() - 30 * 1000).toISOString())).toBe(
      "たった今",
    );
  });

  it("returns minutes ago for under an hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(
      formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000).toISOString()),
    ).toBe("5分前");
  });

  it("returns hours ago for under a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(
      formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()),
    ).toBe("3時間前");
  });

  it("returns days ago for under a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(
      formatRelativeTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()),
    ).toBe("2日前");
  });

  it("falls back to a localized date after a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe(
      new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
    );
  });
});
