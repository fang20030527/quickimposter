import { ArrowCounterClockwise, Eye, Warning } from "@phosphor-icons/react";

import type { GamePhase, WordPair } from "@/game/game-reducer";

type RevealFlowProps = {
  phase: Extract<
    GamePhase,
    "reveal-confirm" | "imposter-revealed" | "civilian-revealed"
  >;
  imposterPlayerNumber: number;
  wordPair: WordPair;
  isCustomGame: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRevealCivilian: () => void;
  onPlayAgain: () => void;
  onChangeSettings: () => void;
};

export function RevealFlow({
  phase,
  imposterPlayerNumber,
  wordPair,
  isCustomGame,
  onCancel,
  onConfirm,
  onRevealCivilian,
  onPlayAgain,
  onChangeSettings,
}: RevealFlowProps) {
  if (phase === "reveal-confirm") {
    return (
      <section className="stage-panel confirm-panel" aria-labelledby="confirm-title">
        <Warning weight="duotone" className="confirm-icon" aria-hidden="true" />
        <span className="stage-label">Final check</span>
        <h2 id="confirm-title">Reveal the imposter?</h2>
        <p>Everyone should finish voting before you continue.</p>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Not yet
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            Reveal imposter
          </button>
        </div>
      </section>
    );
  }

  if (phase === "imposter-revealed") {
    return (
      <section className="stage-panel result-panel" aria-labelledby="imposter-title">
        <span className="stage-label">The imposter</span>
        <h2 id="imposter-title">Player {imposterPlayerNumber}</h2>
        <p>Let them guess the civilian word before revealing it.</p>
        <div className="word-result imposter-result">
          <span>Imposter word</span>
          <strong>{wordPair.imposter}</strong>
        </div>
        <button type="button" className="primary-button" onClick={onRevealCivilian}>
          <Eye weight="bold" aria-hidden="true" />
          Reveal civilian word
        </button>
      </section>
    );
  }

  return (
    <section className="stage-panel result-panel final-result" aria-labelledby="final-title">
      <span className="stage-label">The full word pair</span>
      <h2 id="final-title">Mystery solved.</h2>
      <div className="word-pair-result">
        <div className="word-result">
          <span>Civilians</span>
          <strong>{wordPair.civilian}</strong>
        </div>
        <div className="word-result imposter-result">
          <span>Imposter</span>
          <strong>{wordPair.imposter}</strong>
        </div>
      </div>
      <div className="result-actions">
        {!isCustomGame ? (
          <button type="button" className="primary-button" onClick={onPlayAgain}>
            <ArrowCounterClockwise weight="bold" aria-hidden="true" />
            Play again
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={onChangeSettings}>
          Change settings
        </button>
      </div>
    </section>
  );
}
