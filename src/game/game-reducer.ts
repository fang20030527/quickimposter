export const PLAYER_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type PlayerCount = (typeof PLAYER_COUNTS)[number];
export type Category =
  | "All Categories"
  | "Food"
  | "Animals"
  | "Objects"
  | "Places"
  | "Entertainment"
  | "Sports"
  | "Jobs"
  | "Nature";

export type WordPair = {
  id: string;
  category: Exclude<Category, "All Categories">;
  civilian: string;
  imposter: string;
};

export type GamePhase =
  | "setup"
  | "host-handoff"
  | "player-handoff"
  | "secret-view"
  | "discussion"
  | "reveal-confirm"
  | "imposter-revealed"
  | "civilian-revealed";

export type GameState = {
  phase: GamePhase;
  playerCount: PlayerCount | null;
  category: Category;
  currentPlayerIndex: number;
  wordPair: WordPair | null;
  imposterIndex: number | null;
  hasViewedAnyWord: boolean;
};

export type GameAction =
  | { type: "select-player-count"; playerCount: PlayerCount }
  | { type: "select-category"; category: Category }
  | {
      type: "start-game";
      wordPair: WordPair;
      imposterIndex: number;
      requiresHostHandoff?: boolean;
    }
  | { type: "finish-host-handoff" }
  | { type: "open-secret-view" }
  | { type: "finish-secret-view" }
  | { type: "request-reveal" }
  | { type: "cancel-reveal" }
  | { type: "confirm-reveal" }
  | { type: "reveal-civilian-word" }
  | { type: "change-settings" }
  | {
      type: "play-again";
      wordPair: WordPair;
      imposterIndex: number;
    }
  | { type: "restore-session"; state: GameState };

export function createInitialGameState(): GameState {
  return {
    phase: "setup",
    playerCount: null,
    category: "All Categories",
    currentPlayerIndex: 0,
    wordPair: null,
    imposterIndex: null,
    hasViewedAnyWord: false,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "select-player-count" && state.phase === "setup") {
    return { ...state, playerCount: action.playerCount };
  }

  if (action.type === "select-category" && state.phase === "setup") {
    return { ...state, category: action.category };
  }

  if (
    action.type === "start-game" &&
    state.phase === "setup" &&
    state.playerCount !== null
  ) {
    return {
      ...state,
      phase: action.requiresHostHandoff ? "host-handoff" : "player-handoff",
      currentPlayerIndex: 0,
      wordPair: action.wordPair,
      imposterIndex: action.imposterIndex,
      hasViewedAnyWord: false,
    };
  }

  if (action.type === "finish-host-handoff" && state.phase === "host-handoff") {
    return { ...state, phase: "player-handoff" };
  }

  if (action.type === "open-secret-view" && state.phase === "player-handoff") {
    return { ...state, phase: "secret-view" };
  }

  if (
    action.type === "finish-secret-view" &&
    state.phase === "secret-view" &&
    state.playerCount !== null
  ) {
    const isLastPlayer = state.currentPlayerIndex === state.playerCount - 1;

    return {
      ...state,
      phase: isLastPlayer ? "discussion" : "player-handoff",
      currentPlayerIndex: isLastPlayer
        ? state.currentPlayerIndex
        : state.currentPlayerIndex + 1,
      hasViewedAnyWord: true,
    };
  }

  if (action.type === "request-reveal" && state.phase === "discussion") {
    return { ...state, phase: "reveal-confirm" };
  }

  if (action.type === "cancel-reveal" && state.phase === "reveal-confirm") {
    return { ...state, phase: "discussion" };
  }

  if (action.type === "confirm-reveal" && state.phase === "reveal-confirm") {
    return { ...state, phase: "imposter-revealed" };
  }

  if (
    action.type === "reveal-civilian-word" &&
    state.phase === "imposter-revealed"
  ) {
    return { ...state, phase: "civilian-revealed" };
  }

  if (action.type === "change-settings") {
    return {
      ...createInitialGameState(),
      playerCount: state.playerCount,
      category: state.category,
    };
  }

  if (
    action.type === "play-again" &&
    state.phase === "civilian-revealed" &&
    state.playerCount !== null
  ) {
    return {
      ...state,
      phase: "player-handoff",
      currentPlayerIndex: 0,
      wordPair: action.wordPair,
      imposterIndex: action.imposterIndex,
      hasViewedAnyWord: false,
    };
  }

  if (action.type === "restore-session" && state.phase === "setup") {
    return action.state;
  }

  return state;
}
