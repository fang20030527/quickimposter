import { describe, expect, it } from "vitest";

import robots from "./robots";
import {
  createHomepageStructuredData,
  SEO_DESCRIPTION,
  SEO_TITLE,
  serializeStructuredData,
  SITE_URL,
  siteMetadata,
} from "./seo";
import sitemap from "./sitemap";

describe("homepage SEO", () => {
  it("targets the approved keyword cluster with a canonical URL", () => {
    expect(siteMetadata.title).toBe(SEO_TITLE);
    expect(siteMetadata.description).toBe(SEO_DESCRIPTION);
    expect(siteMetadata.metadataBase?.toString()).toBe(`${SITE_URL}/`);
    expect(siteMetadata.alternates?.canonical).toBe("/");
    expect(siteMetadata.keywords).toContain("imposter game online");
    expect(siteMetadata.keywords).toContain("imposter game generator");
  });

  it("publishes public game facts as safe JSON-LD", () => {
    const structuredData = createHomepageStructuredData();
    const graph = structuredData["@graph"];

    expect(graph.map((entry) => entry["@type"])).toEqual([
      "WebSite",
      "WebApplication",
    ]);
    expect(graph[1]).toMatchObject({
      url: SITE_URL,
      applicationCategory: "GameApplication",
      isAccessibleForFree: true,
      offers: {
        price: "0",
        priceCurrency: "USD",
      },
    });
    expect(serializeStructuredData({ value: "</script>" })).toBe(
      '{"value":"\\u003c/script>"}',
    );
  });

  it("advertises the canonical sitemap in robots.txt", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
      host: SITE_URL,
    });
  });

  it("lists only the canonical HTTPS homepage in the sitemap", () => {
    const entries = sitemap();

    expect(entries).toEqual([{ url: SITE_URL }]);
    expect(entries.every(({ url }) => new URL(url).protocol === "https:")).toBe(
      true,
    );
  });
});
