import {
  ArrowDown,
  DeviceMobile,
  EyeSlash,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import { BrandLogo } from "@/components/brand-logo";
import { GameExperience } from "@/components/game/game-experience";

import {
  createHomepageStructuredData,
  serializeStructuredData,
} from "./seo";

export default function Home() {
  const structuredData = createHomepageStructuredData();

  return (
    <>
      <script
        id="quick-imposter-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(structuredData),
        }}
      />
      <main>
      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label="Quick Imposter home">
          <BrandLogo variant="navigation" fetchPriority="high" />
          <span>Quick Imposter</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-to-play">How to play</a>
          <a href="#questions">FAQ</a>
        </nav>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <BrandLogo variant="hero" />
          <span className="hero-question">Who got the different word?</span>
          <h1 id="hero-title">Free Imposter Game Online for One Phone</h1>
          <p>
            Generate secret words for 3–12 players, pass the phone, and find
            the imposter. No signup or download.
          </p>
          <a className="down-link" href="#game">
            Pick your group size
            <ArrowDown weight="bold" aria-hidden="true" />
          </a>
        </div>
        <div className="game-column" id="game">
          <GameExperience />
        </div>
      </section>

      <section className="promise-strip" aria-label="Game benefits">
        <div><Lightning weight="fill" aria-hidden="true" /><span>Ready in 30 seconds</span></div>
        <div><DeviceMobile weight="fill" aria-hidden="true" /><span>One phone for everyone</span></div>
        <div><ShieldCheck weight="fill" aria-hidden="true" /><span>No signup or download</span></div>
      </section>

      <section className="how-section" id="how-to-play" aria-labelledby="how-title">
        <div className="how-heading">
          <span className="section-kicker">How to play</span>
          <h2 id="how-title">How to play the imposter game</h2>
          <p>
            Start a free imposter word game in three quick steps. The site
            generates the words and keeps every secret hidden.
          </p>
        </div>
        <ol className="steps-list">
          <li>
            <span className="step-number">1</span>
            <div><h3>Choose your group and words</h3><p>Pick 3–12 players, then use the word generator or enter custom words.</p></div>
          </li>
          <li>
            <span className="step-number">2</span>
            <div><h3>Pass and peek</h3><p>Each player holds to reveal one private word.</p></div>
          </li>
          <li>
            <span className="step-number">3</span>
            <div><h3>Describe and vote</h3><p>Give clues, spot the odd word, then reveal the imposter.</p></div>
          </li>
        </ol>
      </section>

      <section className="privacy-section" aria-labelledby="privacy-title">
        <div className="privacy-visual" aria-hidden="true">
          <div className="privacy-card back-card">PASS CLOCKWISE</div>
          <div className="privacy-card front-card">
            <EyeSlash weight="duotone" />
            <strong>Hidden by default</strong>
            <span>Hold to reveal</span>
          </div>
        </div>
        <div className="privacy-copy">
          <h2 id="privacy-title">Secrets stay secret.</h2>
          <p>The word disappears when you let go, switch apps, lock the phone, or lose focus.</p>
          <ul>
            <li>Every player sees the same screen and feedback.</li>
            <li>Finished players cannot go back to their word.</li>
            <li>Refresh returns to a safe handoff screen.</li>
          </ul>
        </div>
      </section>

      <section className="faq-section" id="questions" aria-labelledby="faq-title">
        <h2 id="faq-title">Good to know.</h2>
        <div className="faq-list">
          <details>
            <summary>Does the imposter know their role?</summary>
            <p>No. Everyone sees only a word, so every player has to read the room.</p>
          </details>
          <details>
            <summary>Can we use our own words?</summary>
            <p>Yes. A non-playing host can enter a custom pair before handing over the phone.</p>
          </details>
          <details>
            <summary>What happens after the vote?</summary>
            <p>Reveal the imposter first. Let them guess, then reveal the civilian word.</p>
          </details>
          <details>
            <summary>Is Quick Imposter free to play online?</summary>
            <p>Yes. The full imposter game is free, with no account, app download, or online room required.</p>
          </details>
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand-lockup" href="#top" aria-label="Quick Imposter home">
          <BrandLogo variant="navigation" />
          <span>Quick Imposter</span>
        </a>
        <p>Free online imposter word game. Built for the room you are already in.</p>
      </footer>
      </main>
    </>
  );
}
