import { describe, expect, it } from "vitest";

import { selectWordPair, validateCustomWords } from "./word-repository";

describe("validateCustomWords", () => {
  it("returns trimmed valid custom words", () => {
    expect(validateCustomWords("  Lighthouse ", " Campfire  ")).toEqual({
      ok: true,
      civilian: "Lighthouse",
      imposter: "Campfire",
    });
  });

  it.each([
    ["", "Campfire", "Enter the civilian word."],
    ["Lighthouse", "  ", "Enter the imposter word."],
    ["Lighthouse", "lighthouse", "The two words must be different."],
    ["x".repeat(41), "Campfire", "Keep each word to 40 characters or fewer."],
  ])("rejects invalid custom words", (civilian, imposter, message) => {
    expect(validateCustomWords(civilian, imposter)).toEqual({
      ok: false,
      message,
    });
  });
});

describe("selectWordPair", () => {
  const pairs = [
    {
      id: "food-apple-orange",
      category: "Food" as const,
      civilian: "Apple",
      imposter: "Orange",
    },
    {
      id: "food-coffee-tea",
      category: "Food" as const,
      civilian: "Coffee",
      imposter: "Tea",
    },
  ];

  it("chooses an unused pair before repeating a recent pair", () => {
    expect(
      selectWordPair(pairs, "Food", ["food-apple-orange"], () => 0).id,
    ).toBe("food-coffee-tea");
  });

  it("reuses the least recent pair when every pair was used", () => {
    expect(
      selectWordPair(
        pairs,
        "Food",
        ["food-coffee-tea", "food-apple-orange"],
        () => 0.99,
      ).id,
    ).toBe("food-apple-orange");
  });
});
