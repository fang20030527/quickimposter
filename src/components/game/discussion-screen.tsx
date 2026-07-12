import { useEffect, useRef, useState } from "react";
import { ChatCircleDots, Fingerprint, UsersThree } from "@phosphor-icons/react";

type DiscussionScreenProps = {
  playerCount: number;
  onRevealRequested: () => void;
};

export function DiscussionScreen({
  playerCount,
  onRevealRequested,
}: DiscussionScreenProps) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  function beginHold() {
    if (holdTimer.current) return;
    setIsHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setIsHolding(false);
      onRevealRequested();
    }, 2000);
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setIsHolding(false);
  }

  return (
    <section className="stage-panel discussion-panel" aria-labelledby="discussion-title">
      <div className="stage-icon coral-icon" aria-hidden="true">
        <UsersThree weight="duotone" />
      </div>
      <span className="stage-label">All {playerCount} players are ready</span>
      <h2 id="discussion-title">Describe. Listen. Vote.</h2>
      <p>Give one clue about your word without saying it directly.</p>

      <ol className="rule-list">
        <li>
          <ChatCircleDots weight="duotone" aria-hidden="true" />
          <span><strong>Take turns</strong> and keep each clue short.</span>
        </li>
        <li>
          <Fingerprint weight="duotone" aria-hidden="true" />
          <span><strong>Vote out loud</strong> when everyone has spoken.</span>
        </li>
      </ol>

      <button
        type="button"
        className="hold-button"
        data-holding={isHolding}
        onPointerDown={beginHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") beginHold();
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") cancelHold();
        }}
      >
        <span className="hold-progress" aria-hidden="true" />
        <span className="hold-content">
          <Fingerprint weight="bold" aria-hidden="true" />
          Hold 2 seconds to reveal
        </span>
      </button>
    </section>
  );
}
