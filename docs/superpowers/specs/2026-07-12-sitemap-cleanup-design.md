# Quick Imposter Sitemap Cleanup Design

Date: 2026-07-12
Status: Approved

## Goal

Keep `https://www.quickimposter.org/sitemap.xml` limited to real, canonical, indexable pages and remove metadata that does not provide a useful search-engine signal.

## Current Site Structure

The App Router currently exposes one indexable page:

| Route | Canonical URL | Include in sitemap |
| --- | --- | --- |
| `/` | `https://www.quickimposter.org` | Yes |

Metadata endpoints such as `/robots.txt`, `/sitemap.xml`, the app icon, and the generated Open Graph image are not content pages and will not be listed. No future or placeholder routes will be added.

## Selected Approach

Keep the existing Next.js `src/app/sitemap.ts` metadata route so the sitemap shares the canonical `SITE_URL` constant with the rest of the SEO configuration.

The homepage entry will contain only its absolute HTTPS URL. `changeFrequency` and `priority` will be removed because Google ignores them. `lastModified` will be omitted because the project has no reliable page-level publication or modification timestamp; generating the current time would create a misleading freshness signal.

A static `sitemap.xml` was rejected because it would duplicate the production origin and could drift from `src/app/seo.ts`. Keeping the existing fields unchanged was rejected because they add noise without improving indexing.

## Responsibility Boundaries

- `src/app/seo.ts` owns the canonical production origin.
- `src/app/sitemap.ts` exposes canonical public page discovery only.
- `src/app/robots.ts` continues to advertise the sitemap URL.
- `STRUCTURE.md` documents the current indexable route inventory and the rules for adding future routes.
- `src/app/seo.test.ts` verifies sitemap and robots consistency.

## Output and Error Handling

Next.js will serialize the typed `MetadataRoute.Sitemap` result to valid sitemap XML at `/sitemap.xml`. The implementation will not perform network or filesystem work at request time.

The sitemap must contain:

- One `<url>` entry
- One `<loc>` value: `https://www.quickimposter.org`
- No non-canonical, redirected, private, generated metadata, or placeholder URLs
- No `priority`, `changefreq`, or fabricated `lastmod` fields

## Verification

Automated checks will assert that:

- The sitemap returns only the canonical homepage URL.
- Every sitemap URL uses HTTPS.
- Sitemap entries do not include ignored or unsupported freshness hints.
- `robots.ts` references `https://www.quickimposter.org/sitemap.xml`.

Project verification will run the focused SEO test, the full test suite, lint, and a production build. The build output will confirm that `/sitemap.xml` and `/robots.txt` compile under the installed Next.js 16.2.10 conventions.

## Out of Scope

- Adding pages or reserving future routes
- Adding image, video, or localized sitemap extensions
- Deployment or submitting the sitemap to search-engine consoles
- Changing canonical metadata, robots crawling policy, or application UI
