import { ArrowRight, DeviceMobile } from "@phosphor-icons/react";

type PrivacyHandoffProps = {
  playerNumber?: number;
  isHostHandoff?: boolean;
  onContinue: () => void;
};

export function PrivacyHandoff({
  playerNumber,
  isHostHandoff = false,
  onContinue,
}: PrivacyHandoffProps) {
  const title = isHostHandoff
    ? "Pass to Player 1"
    : `Pass to Player ${playerNumber}`;

  return (
    <section className="stage-panel handoff-panel" aria-labelledby="handoff-title">
      <div className="stage-icon" aria-hidden="true">
        <DeviceMobile weight="duotone" />
      </div>
      <span className="stage-label">
        {isHostHandoff ? "Host handoff" : "Pass clockwise"}
      </span>
      <h2 id="handoff-title">{title}</h2>
      <p>
        {isHostHandoff
          ? "The host should hand over the phone without joining the round."
          : "Keep the screen facing down until the next player is ready."}
      </p>
      <button type="button" className="primary-button" onClick={onContinue}>
        {isHostHandoff ? "Player 1 is ready" : "I have the phone"}
        <ArrowRight weight="bold" aria-hidden="true" />
      </button>
    </section>
  );
}
