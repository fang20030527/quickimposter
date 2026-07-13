import Image from "next/image";

import heroBackground from "../../public/generated/hero-background-illustration.png";
import heroHeadline from "../../public/generated/hero-headline-art.png";

export function HeroArtwork() {
  return (
    <div className="hero-artwork" aria-hidden="true">
      <Image
        className="hero-artwork-background"
        src={heroBackground}
        alt=""
        fill
        sizes="(max-width: 900px) calc(100vw - 32px), 700px"
        priority
        unoptimized
      />
      <Image
        className="hero-artwork-headline"
        src={heroHeadline}
        alt=""
        fill
        sizes="(max-width: 900px) calc(100vw - 32px), 700px"
        priority
        unoptimized
      />
    </div>
  );
}
