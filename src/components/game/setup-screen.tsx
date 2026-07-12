import { useState } from "react";
import { Check, PencilSimple, Shuffle } from "@phosphor-icons/react";

import {
  PLAYER_COUNTS,
  type Category,
  type PlayerCount,
  type WordPair,
} from "@/game/game-reducer";
import { validateCustomWords } from "@/game/word-repository";

const CATEGORIES: readonly Category[] = [
  "All Categories",
  "Food",
  "Animals",
  "Objects",
  "Places",
  "Entertainment",
  "Sports",
  "Jobs",
  "Nature",
];

type SetupScreenProps = {
  playerCount: PlayerCount | null;
  category: Category;
  onPlayerCountChange: (count: PlayerCount) => void;
  onCategoryChange: (category: Category) => void;
  onStartSystemGame: () => void;
  onStartCustomGame: (pair: WordPair) => void;
};

export function SetupScreen({
  playerCount,
  category,
  onPlayerCountChange,
  onCategoryChange,
  onStartSystemGame,
  onStartCustomGame,
}: SetupScreenProps) {
  const [mode, setMode] = useState<"system" | "custom">("system");
  const [civilianWord, setCivilianWord] = useState("");
  const [imposterWord, setImposterWord] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  function startCustomGame() {
    const result = validateCustomWords(civilianWord, imposterWord);
    if (!result.ok) {
      setCustomError(result.message);
      return;
    }

    setCustomError(null);
    onStartCustomGame({
      id: `custom-${Date.now()}`,
      category: "Objects",
      civilian: result.civilian,
      imposter: result.imposter,
    });
  }

  return (
    <section className="setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <span className="section-kicker">Set up your game</span>
        <h2 id="setup-title">How many are playing?</h2>
        <p>Choose everyone who will receive a secret word.</p>
      </div>

      <div className="player-grid" aria-label="Player count">
        {PLAYER_COUNTS.map((count) => (
          <button
            type="button"
            className="number-button"
            key={count}
            aria-pressed={playerCount === count}
            onClick={() => onPlayerCountChange(count)}
          >
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">{count} players</span>
            {playerCount === count ? (
              <Check weight="bold" className="number-check" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="mode-switch" aria-label="Word source">
        <button
          type="button"
          aria-pressed={mode === "system"}
          onClick={() => setMode("system")}
        >
          <Shuffle weight="bold" aria-hidden="true" />
          Random words
        </button>
        <button
          type="button"
          aria-pressed={mode === "custom"}
          onClick={() => setMode("custom")}
        >
          <PencilSimple weight="bold" aria-hidden="true" />
          Custom words
        </button>
      </div>

      {mode === "system" ? (
        <div className="field-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value as Category)}
          >
            {CATEGORIES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <p className="field-help">Every player gets a familiar, related word.</p>
        </div>
      ) : (
        <div className="custom-fields">
          <p className="host-note">
            The host who enters these words should not play this round.
          </p>
          <div className="field-group">
            <label htmlFor="civilian-word">Civilian word</label>
            <input
              id="civilian-word"
              value={civilianWord}
              maxLength={40}
              autoComplete="off"
              onChange={(event) => setCivilianWord(event.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="imposter-word">Imposter word</label>
            <input
              id="imposter-word"
              value={imposterWord}
              maxLength={40}
              autoComplete="off"
              onChange={(event) => setImposterWord(event.target.value)}
            />
          </div>
          {customError ? (
            <p className="field-error" role="alert">
              {customError}
            </p>
          ) : null}
        </div>
      )}

      <button
        type="button"
        className="primary-button play-button"
        disabled={playerCount === null}
        onClick={mode === "system" ? onStartSystemGame : startCustomGame}
      >
        Play
      </button>
    </section>
  );
}
