import type { GameState } from "./game-reducer";

const SESSION_KEY = "quick-imposter:active-game";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createSafeRecoveryState(state: GameState): GameState {
  if (state.phase === "secret-view") {
    return { ...state, phase: "player-handoff" };
  }

  if (state.phase === "reveal-confirm") {
    return { ...state, phase: "discussion" };
  }

  return state;
}

export function saveGameSession(
  storage: StorageLike,
  state: GameState,
): boolean {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(createSafeRecoveryState(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadGameSession(storage: StorageLike): GameState | null {
  try {
    const savedState = storage.getItem(SESSION_KEY);
    if (!savedState) return null;

    return createSafeRecoveryState(JSON.parse(savedState) as GameState);
  } catch {
    return null;
  }
}

export function clearGameSession(storage: StorageLike): void {
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    // Storage is a progressive enhancement. The in-memory game stays usable.
  }
}
