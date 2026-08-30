import { describe, expect, it } from "vitest";
import { toProfile, type ProfileRow } from "./profile-mapper";

function makeRow(overrides: Partial<ProfileRow>): ProfileRow {
  return {
    id: "u1",
    handle: "alice",
    display_name: "Alice",
    created_at: "2026-01-01T00:00:00Z",
    theme_color: null,
    bio: null,
    cover_url: null,
    avatar_url: null,
    pinned_post_id: null,
    ...overrides,
  };
}

describe("toProfile", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const row = makeRow({
      theme_color: "#fff",
      bio: "hello",
      cover_url: "https://example.com/cover.png",
      avatar_url: "https://example.com/avatar.png",
      pinned_post_id: "p1",
    });
    expect(toProfile(row)).toEqual({
      id: "u1",
      handle: "alice",
      displayName: "Alice",
      createdAt: "2026-01-01T00:00:00Z",
      themeColor: "#fff",
      bio: "hello",
      coverUrl: "https://example.com/cover.png",
      avatarUrl: "https://example.com/avatar.png",
      pinnedPostId: "p1",
    });
  });

  it("passes through nulls for optional fields", () => {
    const profile = toProfile(makeRow({}));
    expect(profile.themeColor).toBeNull();
    expect(profile.bio).toBeNull();
    expect(profile.coverUrl).toBeNull();
    expect(profile.avatarUrl).toBeNull();
    expect(profile.pinnedPostId).toBeNull();
  });
});
