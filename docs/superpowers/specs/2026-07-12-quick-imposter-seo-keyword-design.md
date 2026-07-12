# Quick Imposter SEO Keyword Optimization Design

Date: 2026-07-12
Status: Approved direction, pending written-spec review

## Goal

Improve the English homepage's organic-search relevance for people who want to start an in-person imposter word game immediately, while preserving the product's fast, game-first experience.

The canonical production origin is `https://quickimposter.org`. The first target market is the United States, with the United Kingdom, Australia, and Canada as secondary English-language markets.

## Evidence and Keyword Selection

All volume and keyword-difficulty figures below are measured in the Semrush United States desktop database on 2026-07-12.

| Keyword | US monthly volume | KD | Intent | Homepage role |
| --- | ---: | ---: | --- | --- |
| `imposter game` | 165,000 | 32 | Broad commercial/play | Natural broad-topic coverage; not the sole primary term because the query can include Among Us and unrelated digital games |
| `imposter game generator` | 12,100 | 25 | Commercial | Primary supporting term describing the product function |
| `imposter game online` | 9,900 | 12 | Transactional/play | Primary homepage keyword because it combines strong demand, low difficulty, and direct product fit |
| `imposter word game` | 5,400 | 23 | Commercial/play | Secondary term clarifying the game format |
| `imposter game word generator` | 2,900 | 28 | Commercial | Long-tail supporting term |
| `imposter party word game` | 2,400 | 42 | Commercial/play | Semantic party-game support, not a primary target because of higher difficulty |
| `imposter game words` | 1,900 | 28 | Informational | Supporting content term for word categories and custom words |
| `word imposter game` | 1,300 | 24 | Commercial/play | Natural-language variation only |
| `how to play imposter game` | 1,000 | 25 | Informational | How-to section and concise-answer target |
| `how to play the imposter game` | 320 | 14 | Informational | How-to section and GEO support |
| `how to play imposter word game` | 260 | 23 | Informational | How-to section and FAQ support |
| `imposter game online free` | 210 | 17 | Transactional/play | Natural supporting phrase; not repeated mechanically |

`undercover game online` was rejected as a homepage target despite its low KD of 17 because its US volume is only 140 and the result set contains unrelated entertainment properties. The selected cluster is both larger and more faithful to the product.

Using the research skill's opportunity formula, the selected high-intent terms score as follows:

- `imposter game online`: `(9,900 × 3) / 12 = 2,475`
- `imposter game generator`: `(12,100 × 2) / 25 = 968`
- `imposter word game`: `(5,400 × 2) / 23 ≈ 470`

The broad `imposter game` term has a larger mathematical score because of its 165,000 volume, but intent ambiguity makes it less suitable as the sole homepage target. Product fit takes precedence over a volume-only ranking.

## Selected Strategy

The homepage will target a high-intent combination:

- Primary: `imposter game online`
- Primary support: `imposter game generator`
- Secondary: `imposter word game`
- Semantic support: `imposter game`, `imposter game words`, `party word game`, `how to play imposter game`

The planned search title is:

> Free Imposter Game Online & Word Generator | Quick Imposter

The planned search description is:

> Play a free imposter game online with 3–12 players and one phone. Generate secret words, pass and reveal, then find the imposter—no signup or download.

The planned H1 is:

> Free Imposter Game Online for One Phone

The current question-led message, “Who got the different word?”, will remain near the hero as supporting brand copy rather than serving as the only H1.

## On-Page Content Design

The game remains above the explanatory content and can still be started without reading SEO copy.

### Hero

The hero will state the primary keyword and the differentiator: a free online imposter word game that works by passing one phone. Supporting copy will naturally mention the word generator, 3–12 players, no signup, and no download.

### Product benefits

The existing 30-second setup, one-phone play, and no-signup promises remain. Small copy changes may improve semantic clarity but will not add keyword repetition for its own sake.

### How to play

The existing three-step section will answer `how to play imposter game` directly:

1. Choose 3–12 players and let the generator select related secret words.
2. Pass one phone so every player privately reveals a word.
3. Describe, discuss, vote, and reveal the imposter.

The answer must remain concise enough for users and AI answer engines to extract without hiding the game behind long content.

### Word and game semantics

The setup and supporting sections will clarify that the game includes generated category words and optional custom words. This covers word-related queries without publishing static secret-word lists that would conflict with the playable product.

### FAQ

FAQ copy will answer genuine gameplay questions and support relevant long tails. No new `FAQPage` structured data will be added for Google rich-result purposes because Google retired FAQ rich results for general sites. The visible FAQ remains useful for users and AI citation context.

## Metadata and Technical SEO

`src/app/layout.tsx` will define site-wide metadata using `https://quickimposter.org` as `metadataBase` and canonical origin. The homepage will include:

- Search title and description aligned with the selected keyword cluster
- Canonical URL `/`
- Open Graph title, description, URL, site name, locale, and image
- Twitter summary-large-image metadata
- Search-engine indexing directives
- A focused metadata keyword list for non-Google consumers; visible content remains the main relevance signal because Google ignores the `meta keywords` tag

The App Router metadata conventions will be used for:

- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/opengraph-image.tsx` as the shared 1200 × 630 social preview image

Structured data will use a graph containing `WebSite` and `WebApplication`. The application will use `applicationCategory: "GameApplication"`, `operatingSystem: "Any"`, and an `Offer` with price `0` in USD. It will include the canonical URL, name, description, browser availability, and English audience. It will not expose secret words, game state, player roles, or custom inputs.

## Component and Responsibility Boundaries

- `layout.tsx`: global metadata and document language only
- `page.tsx`: visible homepage copy and insertion of the homepage structured-data component
- A small SEO data module: canonical constants, JSON-LD object construction, and serializable public product facts
- `robots.ts`: crawler policy only
- `sitemap.ts`: public URL discovery only
- `opengraph-image.tsx`: social preview rendering only

Each module will have one responsibility. Game state and SEO data will remain separate so no private session information can enter metadata or structured data.

## Error and Safety Handling

- The canonical origin will be a valid absolute HTTPS URL.
- JSON-LD serialization will escape `<` characters so embedded data cannot terminate the script element.
- Only static public product facts will be serialized.
- Robots and sitemap output will reference the same canonical origin.
- No deployment, Search Console submission, or external publishing is included in this implementation.

## Verification

Automated verification will cover:

- Exact homepage title and description
- Canonical URL and `metadataBase`
- Open Graph and Twitter metadata
- One visible H1 containing the primary topic
- JSON-LD types, canonical URL, and free-offer claim
- Robots allow/index behavior and sitemap origin consistency

Project-wide checks:

```text
pnpm lint
pnpm test
pnpm build
```

The rendered homepage will also be checked to confirm that the game remains above long-form content and that the metadata files compile under the repository's installed Next.js version.

## Success and Falsifiability

Leading indicators after deployment:

- Google Search Console begins reporting impressions for the selected keyword cluster.
- Homepage click-through rate can be compared after title indexing stabilizes.
- `imposter game online`, `imposter game generator`, and `imposter word game` receive query impressions without separate thin landing pages.
- Organic visitors continue reaching the game setup without a measurable decline in start rate.

The strategy should be considered unsuccessful or in need of revision if, after indexing and a reasonable observation period:

- The homepage gains broad `imposter game` impressions but almost no high-intent generator/online impressions.
- Search snippets rewrite the title consistently because the title does not match visible content.
- Organic landing users bounce before interacting with the setup flow.
- Search Console shows sustained cannibalization from future pages targeting the same primary terms.

Future content pages should therefore use distinct informational intent, such as a comprehensive rules guide or curated word-category guide, and link back to the playable homepage rather than duplicating its transactional target.

## Out of Scope

- Keyword-stuffed or programmatically generated landing pages
- Backlink campaigns or paid ads
- Search Console or Bing Webmaster submission
- Localization or hreflang
- Publishing a static list of all secret word pairs
- Deployment or domain/DNS changes
