import { useEffect, useState } from "react";
import { Eye, EyeSlash, LockKey, Warning } from "@phosphor-icons/react";

type SecretWordScreenProps = {
  playerNumber: number;
  word: string;
  onDone: () => void;
};

export function SecretWordScreen({
  playerNumber,
  word,
  onDone,
}: SecretWordScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [toggleMode, setToggleMode] = useState(false);

  useEffect(() => {
    const hideSecret = () => setIsVisible(false);
    const hideWhenBackgrounded = () => {
      if (document.visibilityState === "hidden") hideSecret();
    };

    window.addEventListener("blur", hideSecret);
    window.addEventListener("pagehide", hideSecret);
    document.addEventListener("visibilitychange", hideWhenBackgrounded);

    return () => {
      window.removeEventListener("blur", hideSecret);
      window.removeEventListener("pagehide", hideSecret);
      document.removeEventListener("visibilitychange", hideWhenBackgrounded);
    };
  }, []);

  function handleKeyboardDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!toggleMode && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      setIsVisible(true);
    }
  }

  function handleKeyboardUp(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!toggleMode && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      setIsVisible(false);
    }
  }

  return (
    <section className="stage-panel secret-panel" aria-labelledby="secret-title">
      <div className="secret-header">
        <span className="stage-label">Player {playerNumber}</span>
        <LockKey weight="fill" aria-hidden="true" />
      </div>
      <h2 id="secret-title">Your word is private.</h2>
      <p>Make sure nobody else can see the screen.</p>

      <button
        type="button"
        className="secret-reveal"
        data-visible={isVisible}
        aria-label={
          toggleMode
            ? isVisible
              ? "Hide your secret word"
              : "Show your secret word"
            : "Press and hold to reveal your secret word"
        }
        onPointerDown={() => !toggleMode && setIsVisible(true)}
        onPointerUp={() => !toggleMode && setIsVisible(false)}
        onPointerCancel={() => setIsVisible(false)}
        onPointerLeave={() => !toggleMode && setIsVisible(false)}
        onKeyDown={handleKeyboardDown}
        onKeyUp={handleKeyboardUp}
        onClick={() => toggleMode && setIsVisible((visible) => !visible)}
      >
        {isVisible ? (
          <>
            <span className="secret-word">{word}</span>
            <span>{toggleMode ? "Tap to hide" : "Release to hide"}</span>
          </>
        ) : (
          <>
            <Eye weight="duotone" aria-hidden="true" />
            <strong>{toggleMode ? "Tap to reveal" : "Press and hold"}</strong>
            <span>Your word appears here</span>
          </>
        )}
      </button>

      <button
        type="button"
        className="text-button secret-access-button"
        onClick={() => {
          setIsVisible(false);
          setShowPrivacyWarning(true);
        }}
      >
        <EyeSlash weight="bold" aria-hidden="true" />
        Need a tap instead?
      </button>

      <button
        type="button"
        className="primary-button secret-done-button"
        onClick={() => {
          setIsVisible(false);
          onDone();
        }}
      >
        I&apos;m done
      </button>

      {showPrivacyWarning ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="privacy-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-dialog-title"
          >
            <Warning weight="duotone" aria-hidden="true" />
            <h3 id="privacy-dialog-title">Protect your word</h3>
            <p>
              Tap mode leaves the word visible until you hide it. Use headphones
              if a screen reader may announce nearby content.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowPrivacyWarning(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setToggleMode(true);
                  setShowPrivacyWarning(false);
                }}
              >
                Use tap mode
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
