const RECENT_PAIRS_KEY = "quick-imposter:recent-pairs";
const RECENT_PAIR_LIMIT = 30;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadRecentPairIds(storage: StorageLike): string[] {
  try {
    const value = storage.getItem(RECENT_PAIRS_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberPairId(storage: StorageLike, pairId: string): boolean {
  try {
    const nextIds = [
      pairId,
      ...loadRecentPairIds(storage).filter((id) => id !== pairId),
    ].slice(0, RECENT_PAIR_LIMIT);
    storage.setItem(RECENT_PAIRS_KEY, JSON.stringify(nextIds));
    return true;
  } catch {
    return false;
  }
}
