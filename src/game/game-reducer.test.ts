import { describe, expect, it } from "vitest";

import { createInitialGameState, gameReducer } from "./game-reducer";

describe("gameReducer", () => {
  it("starts a configured game at the safe handoff screen", () => {
    const configured = gameReducer(createInitialGameState(), {
      type: "select-player-count",
      playerCount: 6,
    });

    const started = gameReducer(configured, {
      type: "start-game",
      wordPair: {
        id: "food-apple-orange",
        category: "Food",
        civilian: "Apple",
        imposter: "Orange",
      },
      imposterIndex: 3,
    });

    expect(started).toMatchObject({
      phase: "player-handoff",
      playerCount: 6,
      currentPlayerIndex: 0,
      imposterIndex: 3,
      hasViewedAnyWord: false,
    });
  });

  it("moves every player through handoff and into discussion", () => {
    let state = gameReducer(createInitialGameState(), {
      type: "select-player-count",
      playerCount: 3,
    });
    state = gameReducer(state, {
      type: "start-game",
      wordPair: {
        id: "food-apple-orange",
        category: "Food",
        civilian: "Apple",
        imposter: "Orange",
      },
      imposterIndex: 1,
    });

    for (let playerIndex = 0; playerIndex < 3; playerIndex += 1) {
      state = gameReducer(state, { type: "open-secret-view" });
      expect(state.phase).toBe("secret-view");

      state = gameReducer(state, { type: "finish-secret-view" });
      expect(state.currentPlayerIndex).toBe(
        playerIndex === 2 ? 2 : playerIndex + 1,
      );
    }

    expect(state.phase).toBe("discussion");
    expect(state.hasViewedAnyWord).toBe(true);
  });

  it("reveals the imposter before the civilian word", () => {
    const inDiscussion = {
      ...createInitialGameState(),
      phase: "discussion" as const,
      playerCount: 6 as const,
      currentPlayerIndex: 5,
      wordPair: {
        id: "food-lime-lemon",
        category: "Food" as const,
        civilian: "Lemon",
        imposter: "Lime",
      },
      imposterIndex: 3,
      hasViewedAnyWord: true,
    };

    const confirming = gameReducer(inDiscussion, { type: "request-reveal" });
    expect(confirming.phase).toBe("reveal-confirm");

    const imposterRevealed = gameReducer(confirming, {
      type: "confirm-reveal",
    });
    expect(imposterRevealed.phase).toBe("imposter-revealed");

    const civilianRevealed = gameReducer(imposterRevealed, {
      type: "reveal-civilian-word",
    });
    expect(civilianRevealed.phase).toBe("civilian-revealed");
  });

  it("plays again with the same settings and a fresh result", () => {
    const finished = {
      ...createInitialGameState(),
      phase: "civilian-revealed" as const,
      playerCount: 6 as const,
      category: "Food" as const,
      currentPlayerIndex: 5,
      wordPair: {
        id: "food-lime-lemon",
        category: "Food" as const,
        civilian: "Lemon",
        imposter: "Lime",
      },
      imposterIndex: 3,
      hasViewedAnyWord: true,
    };

    const replayed = gameReducer(finished, {
      type: "play-again",
      wordPair: {
        id: "food-coffee-tea",
        category: "Food",
        civilian: "Coffee",
        imposter: "Tea",
      },
      imposterIndex: 1,
    });

    expect(replayed).toMatchObject({
      phase: "player-handoff",
      playerCount: 6,
      category: "Food",
      currentPlayerIndex: 0,
      imposterIndex: 1,
      hasViewedAnyWord: false,
    });
  });
});
