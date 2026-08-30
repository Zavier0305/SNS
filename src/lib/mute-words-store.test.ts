import { describe, expect, it } from "vitest";
import { postMatchesMuteWords } from "./mute-words-store";

describe("postMatchesMuteWords", () => {
  it("returns false when there are no mute words", () => {
    expect(postMatchesMuteWords("hello world", [])).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(postMatchesMuteWords("Hello World", ["world"])).toBe(true);
    expect(postMatchesMuteWords("hello world", ["WORLD"])).toBe(true);
  });

  it("matches substrings, not just whole words", () => {
    expect(postMatchesMuteWords("unhappy", ["happy"])).toBe(true);
  });

  it("returns false when no word matches", () => {
    expect(postMatchesMuteWords("hello world", ["goodbye"])).toBe(false);
  });

  it("returns true if any of several words matches", () => {
    expect(postMatchesMuteWords("hello world", ["nope", "world", "nada"])).toBe(true);
  });
});
