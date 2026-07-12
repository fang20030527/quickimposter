import { describe, expect, it } from "vitest";

import { createInitialGameState } from "./game-reducer";
import { createSafeRecoveryState } from "./session-store";

describe("createSafeRecoveryState", () => {
  it("recovers a secret view as a safe player handoff", () => {
    const secretState = {
      ...createInitialGameState(),
      phase: "secret-view" as const,
      playerCount: 6 as const,
      currentPlayerIndex: 2,
      wordPair: {
        id: "food-lime-lemon",
        category: "Food" as const,
        civilian: "Lemon",
        imposter: "Lime",
      },
      imposterIndex: 3,
      hasViewedAnyWord: true,
    };

    expect(createSafeRecoveryState(secretState)).toMatchObject({
      phase: "player-handoff",
      currentPlayerIndex: 2,
      hasViewedAnyWord: true,
    });
  });
});
