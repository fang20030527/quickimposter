export type CustomWordValidation =
  | { ok: true; civilian: string; imposter: string }
  | { ok: false; message: string };

export function validateCustomWords(
  civilianInput: string,
  imposterInput: string,
): CustomWordValidation {
  const civilian = civilianInput.trim();
  const imposter = imposterInput.trim();

  if (!civilian) {
    return { ok: false, message: "Enter the civilian word." };
  }

  if (!imposter) {
    return { ok: false, message: "Enter the imposter word." };
  }

  if (civilian.length > 40 || imposter.length > 40) {
    return {
      ok: false,
      message: "Keep each word to 40 characters or fewer.",
    };
  }

  if (civilian.toLocaleLowerCase() === imposter.toLocaleLowerCase()) {
    return { ok: false, message: "The two words must be different." };
  }

  return { ok: true, civilian, imposter };
}

export function selectWordPair(
  pairs: readonly WordPair[],
  category: Category,
  recentIds: readonly string[],
  random: () => number = Math.random,
): WordPair {
  const categoryPairs =
    category === "All Categories"
      ? [...pairs]
      : pairs.filter((pair) => pair.category === category);

  if (categoryPairs.length === 0) {
    throw new Error("No valid word pairs are available for this category.");
  }

  const recentSet = new Set(recentIds);
  const unusedPairs = categoryPairs.filter((pair) => !recentSet.has(pair.id));
  if (unusedPairs.length === 0) {
    return categoryPairs.reduce((leastRecent, pair) => {
      return recentIds.indexOf(pair.id) > recentIds.indexOf(leastRecent.id)
        ? pair
        : leastRecent;
    });
  }

  const candidates = unusedPairs;
  const selectedIndex = Math.min(
    candidates.length - 1,
    Math.floor(random() * candidates.length),
  );

  return candidates[selectedIndex];
}
import type { Category, WordPair } from "./game-reducer";
