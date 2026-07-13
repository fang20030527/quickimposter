import type { Metadata } from "next";

export const SITE_NAME = "Quick Imposter";
export const SITE_URL = "https://www.quickimposter.org";
export const SEO_TITLE =
  "Free Imposter Game Online & Word Generator | Quick Imposter";
export const SEO_DESCRIPTION =
  "Play a free imposter game online with 3–12 players and one phone. Generate secret words, pass and reveal, then find the imposter—no signup or download.";

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  keywords: [
    "imposter game online",
    "imposter game generator",
    "imposter word game",
    "imposter game words",
    "party word game",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Quick Imposter free online word game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export function createHomepageStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SEO_DESCRIPTION,
        inLanguage: "en-US",
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#game`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SEO_DESCRIPTION,
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and a modern web browser.",
        isAccessibleForFree: true,
        inLanguage: "en-US",
        audience: {
          "@type": "Audience",
          audienceType: "Groups of 3–12 players aged 13 and older",
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
