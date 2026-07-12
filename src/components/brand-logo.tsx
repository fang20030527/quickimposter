import Image from "next/image";

import logoImage from "../../public/quick-imposter-logo.png";

type BrandLogoProps = {
  variant: "navigation" | "hero";
  fetchPriority?: "high" | "low" | "auto";
};

export function BrandLogo({
  variant,
  fetchPriority = "auto",
}: BrandLogoProps) {
  const displaySize = variant === "hero" ? 148 : 48;

  return (
    <span className={`brand-logo brand-logo-${variant}`} aria-hidden="true">
      <Image
        src={logoImage}
        alt=""
        width={displaySize}
        height={displaySize}
        sizes={`${displaySize}px`}
        fetchPriority={fetchPriority}
      />
    </span>
  );
}
