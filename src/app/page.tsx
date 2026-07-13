import Image from "next/image";
import {
  CaretDown,
  ChatCircleDots,
  CheckCircle,
  DeviceMobile,
  Eye,
  Lightning,
  List,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import privacyArtwork from "../../public/privacy-phone-card-hd.png";
import { BrandLogo } from "@/components/brand-logo";
import { GameExperience } from "@/components/game/game-experience";
import { HeroArtwork } from "@/components/hero-artwork";

import {
  createHomepageStructuredData,
  serializeStructuredData,
} from "./seo";

const BENEFITS = [
  {
    icon: Lightning,
    title: "Ready in 30 seconds",
    description: "Start fast. Play right away.",
  },
  {
    icon: DeviceMobile,
    title: "One phone for everyone",
    description: "Pass it around. That’s it.",
  },
  {
    icon: ShieldCheck,
    title: "No signup or download",
    description: "Open the site and play.",
  },
] as const;

const STEPS = [
  {
    icon: UsersThree,
    title: "Choose your group",
    description: "Pick 3–12 players and a word category.",
  },
  {
    icon: Eye,
    title: "Pass and peek",
    description: "Each player holds to reveal one private word.",
  },
  {
    icon: ChatCircleDots,
    title: "Describe and vote",
    description: "Give clues, spot the odd word, then reveal the imposter.",
  },
] as const;

const FAQS = [
  {
    question: "Does the imposter know their role?",
    answer:
      "No. Everyone sees only a word, so every player has to read the room.",
  },
  {
    question: "Can we use our own words?",
    answer:
      "Yes. A non-playing host can enter a custom pair before handing over the phone.",
  },
  {
    question: "What happens after the vote?",
    answer:
      "Reveal the imposter first. Let them guess, then reveal the civilian word.",
  },
  {
    question: "Is Quick Imposter free to play online?",
    answer:
      "Yes. The full imposter game is free, with no account, app download, or online room required.",
  },
] as const;

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
      <main className="site-shell">
        <SiteHeader />

        <div className="homepage-grid">
          <section className="hero-copy" id="top" aria-labelledby="hero-title">
            <HeroArtwork />
            <h1 className="sr-only" id="hero-title">
              Free Imposter Game Online for One Phone
            </h1>
            <p>
              Generate secret words for 3–12 players, pass the phone, and find
              the imposter. No signup or download.
            </p>
          </section>

          <div className="game-column" id="game">
            <GameExperience />
          </div>

          <section className="promise-strip" aria-label="Game benefits">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <article key={title}>
                <Icon weight="duotone" aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </section>

          <section
            className="how-section"
            id="how-to-play"
            aria-labelledby="how-title"
          >
            <div className="how-heading">
              <span className="section-kicker">How to play</span>
              <h2
                id="how-title"
                aria-label="How to play the imposter game"
              >
                A whole game in one hand.
              </h2>
              <p>
                Set up once, then pass the phone clockwise. The site handles
                every secret.
              </p>
            </div>
            <ol className="steps-list">
              {STEPS.map(({ icon: Icon, title, description }, index) => (
                <li key={title}>
                  <span className="step-number">0{index + 1}</span>
                  <Icon weight="duotone" aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="privacy-section" aria-labelledby="privacy-title">
            <div className="privacy-visual" aria-hidden="true">
              <Image
                src={privacyArtwork}
                alt=""
                width={1536}
                height={1024}
                sizes="(max-width: 900px) 42vw, 260px"
              />
            </div>
            <div className="privacy-copy">
              <h2 id="privacy-title">Secrets stay secret.</h2>
              <p>
                The word disappears when you let go, switch apps, lock the
                phone, or lose focus.
              </p>
              <ul>
                <li>
                  <CheckCircle weight="fill" aria-hidden="true" />
                  Every player sees the same screen and feedback.
                </li>
                <li>
                  <CheckCircle weight="fill" aria-hidden="true" />
                  Finished players cannot go back to their word.
                </li>
                <li>
                  <CheckCircle weight="fill" aria-hidden="true" />
                  Refresh returns to a safe handoff screen.
                </li>
              </ul>
            </div>
          </section>
        </div>

        <section className="faq-section" id="questions" aria-labelledby="faq-title">
          <h2 id="faq-title">Good to know.</h2>
          <div className="faq-list">
            {FAQS.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  <span>{question}</span>
                  <CaretDown weight="bold" aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          <a className="brand-lockup" href="#top" aria-label="Quick Imposter home">
            <BrandLogo variant="navigation" />
          </a>
          <p>Free to play. Built for the room you are already in.</p>
          <nav aria-label="Footer navigation">
            <a href="#how-to-play">How to play</a>
            <a href="#questions">FAQ</a>
          </nav>
        </footer>
      </main>
    </>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand-lockup" href="#top" aria-label="Quick Imposter home">
        <BrandLogo variant="navigation" fetchPriority="high" />
      </a>
      <nav className="desktop-nav" aria-label="Main navigation">
        <a href="#how-to-play">How to play</a>
        <a href="#questions">FAQ</a>
        <a className="header-play-button" href="#game">
          <Lightning weight="fill" aria-hidden="true" />
          Play now
        </a>
      </nav>
      <details className="mobile-menu">
        <summary aria-label="Open navigation">
          <List weight="bold" aria-hidden="true" />
        </summary>
        <nav aria-label="Mobile navigation">
          <a href="#game">Play now</a>
          <a href="#how-to-play">How to play</a>
          <a href="#questions">FAQ</a>
        </nav>
      </details>
    </header>
  );
}
