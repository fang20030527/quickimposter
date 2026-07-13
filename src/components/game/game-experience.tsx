"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import {
  createInitialGameState,
  gameReducer,
  type WordPair,
} from "@/game/game-reducer";
import {
  loadRecentPairIds,
  rememberPairId,
} from "@/game/recent-pairs-store";
import {
  clearGameSession,
  loadGameSession,
  saveGameSession,
} from "@/game/session-store";
import { selectWordPair } from "@/game/word-repository";
import { WORD_PAIRS } from "@/game/word-pairs";
import { DiscussionScreen } from "./discussion-screen";
import { PrivacyHandoff } from "./privacy-handoff";
import { RevealFlow } from "./reveal-flow";
import { SecretWordScreen } from "./secret-word-screen";
import { SetupScreen } from "./setup-screen";

export function GameExperience() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const skipFirstSave = useRef(true);

  useEffect(() => {
    const restoredState = loadGameSession(window.sessionStorage);
    if (restoredState) {
      dispatch({ type: "restore-session", state: restoredState });
    }
  }, []);

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const didSave = saveGameSession(window.sessionStorage, state);
    if (!didSave) {
      queueMicrotask(() => {
        setStorageNotice(
          "Refresh recovery is unavailable, but you can keep playing.",
        );
      });
    }
  }, [state]);

  function chooseSystemPair(): WordPair | null {
    try {
      return selectWordPair(
        WORD_PAIRS,
        state.category,
        loadRecentPairIds(window.localStorage),
      );
    } catch {
      setStorageNotice("This category could not load. Choose another category and retry.");
      return null;
    }
  }

  function startSystemGame() {
    if (state.playerCount === null) return;
    const wordPair = chooseSystemPair();
    if (!wordPair) return;

    dispatch({
      type: "start-game",
      wordPair,
      imposterIndex: Math.floor(Math.random() * state.playerCount),
    });
  }

  function startCustomGame(wordPair: WordPair) {
    if (state.playerCount === null) return;
    dispatch({
      type: "start-game",
      wordPair,
      imposterIndex: Math.floor(Math.random() * state.playerCount),
      requiresHostHandoff: true,
    });
  }

  function finishSecretView() {
    if (!state.hasViewedAnyWord && state.wordPair && !isCustomGame(state.wordPair)) {
      const didRemember = rememberPairId(window.localStorage, state.wordPair.id);
      if (!didRemember) {
        setStorageNotice("Repeat avoidance is unavailable, but this game still works.");
      }
    }
    dispatch({ type: "finish-secret-view" });
  }

  function playAgain() {
    if (state.playerCount === null) return;
    const wordPair = chooseSystemPair();
    if (!wordPair) return;
    dispatch({
      type: "play-again",
      wordPair,
      imposterIndex: Math.floor(Math.random() * state.playerCount),
    });
  }

  function changeSettings() {
    clearGameSession(window.sessionStorage);
    dispatch({ type: "change-settings" });
  }

  let content: React.ReactNode;

  if (state.phase === "setup") {
    content = (
      <SetupScreen
        playerCount={state.playerCount}
        category={state.category}
        onPlayerCountChange={(playerCount) =>
          dispatch({ type: "select-player-count", playerCount })
        }
        onCategoryChange={(category) =>
          dispatch({ type: "select-category", category })
        }
        onStartSystemGame={startSystemGame}
        onStartCustomGame={startCustomGame}
      />
    );
  } else if (state.phase === "host-handoff") {
    content = (
      <PrivacyHandoff
        isHostHandoff
        onContinue={() => dispatch({ type: "finish-host-handoff" })}
      />
    );
  } else if (state.phase === "player-handoff") {
    content = (
      <PrivacyHandoff
        playerNumber={state.currentPlayerIndex + 1}
        onContinue={() => dispatch({ type: "open-secret-view" })}
      />
    );
  } else if (state.phase === "secret-view" && state.wordPair) {
    const word =
      state.currentPlayerIndex === state.imposterIndex
        ? state.wordPair.imposter
        : state.wordPair.civilian;
    content = (
      <SecretWordScreen
        playerNumber={state.currentPlayerIndex + 1}
        word={word}
        onDone={finishSecretView}
      />
    );
  } else if (state.phase === "discussion" && state.playerCount !== null) {
    content = (
      <DiscussionScreen
        playerCount={state.playerCount}
        onRevealRequested={() => dispatch({ type: "request-reveal" })}
      />
    );
  } else if (
    (state.phase === "reveal-confirm" ||
      state.phase === "imposter-revealed" ||
      state.phase === "civilian-revealed") &&
    state.wordPair &&
    state.imposterIndex !== null
  ) {
    content = (
      <RevealFlow
        phase={state.phase}
        imposterPlayerNumber={state.imposterIndex + 1}
        wordPair={state.wordPair}
        isCustomGame={isCustomGame(state.wordPair)}
        onCancel={() => dispatch({ type: "cancel-reveal" })}
        onConfirm={() => dispatch({ type: "confirm-reveal" })}
        onRevealCivilian={() => dispatch({ type: "reveal-civilian-word" })}
        onPlayAgain={playAgain}
        onChangeSettings={changeSettings}
      />
    );
  } else {
    content = (
      <section className="stage-panel error-panel" role="alert">
        <h2>This round could not be restored.</h2>
        <p>Your secret information remains hidden.</p>
        <button type="button" className="primary-button" onClick={changeSettings}>
          Return to settings
        </button>
      </section>
    );
  }

  return (
    <div
      className="game-experience"
      data-phase={state.phase}
      data-active={state.phase !== "setup"}
    >
      {storageNotice ? (
        <div className="storage-notice" role="status">
          <span>{storageNotice}</span>
          <button type="button" onClick={() => setStorageNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {content}
    </div>
  );
}

function isCustomGame(wordPair: WordPair): boolean {
  return wordPair.id.startsWith("custom-");
}
