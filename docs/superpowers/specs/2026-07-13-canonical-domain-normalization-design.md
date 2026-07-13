# Quick Imposter Canonical Domain Normalization Design

Date: 2026-07-13
Status: Approved

## Goal

Make every public SEO signal use the URL that currently returns a direct `200` response: `https://www.quickimposter.org`.

## Evidence

The deployed site currently behaves as follows:

- `https://quickimposter.org/` returns `308` and redirects to `https://www.quickimposter.org/`.
- `https://www.quickimposter.org/` returns `200`.
- The sitemap, canonical link, Open Graph URL, and structured data currently identify the redirecting non-`www` URL.

This creates conflicting signals and places a redirected URL in the sitemap.

## Selected Approach

Keep the current Vercel redirect direction and make `https://www.quickimposter.org` the canonical production origin.

Update the shared `SITE_URL` constant rather than editing each consumer separately. Existing consumers will then produce consistent values for:

- `metadataBase` and the homepage canonical link
- Open Graph URL
- `WebSite` and `WebApplication` structured data
- `robots.txt` host and sitemap reference
- The homepage entry in `sitemap.xml`

Changing the Vercel primary domain to the non-`www` hostname was rejected because it requires deployment configuration outside this code change and reverses the currently deployed redirect behavior. Hard-coding `www` separately in each metadata file was rejected because duplicated origins can drift.

## Responsibility Boundaries

- `src/app/seo.ts` remains the single source of truth for the canonical production origin.
- `src/app/sitemap.ts` and `src/app/robots.ts` continue to consume that origin without owning domain policy.
- Existing SEO tests verify that all generated values remain aligned.
- `STRUCTURE.md` and the sitemap cleanup design document will be updated so documentation matches production behavior.

## Verification

Automated checks will assert the exact canonical origin and continue validating sitemap, robots, Open Graph, and structured-data consistency. The full test suite, lint, and production build will run.

After deployment, the expected public behavior is:

- `https://www.quickimposter.org` returns `200`.
- `https://quickimposter.org` redirects permanently to the canonical `www` URL.
- `https://www.quickimposter.org/sitemap.xml` contains only `https://www.quickimposter.org`.
- The homepage canonical link identifies `https://www.quickimposter.org`.

Local verification cannot prove the post-deployment response until the updated build is deployed; it will verify the generated metadata and XML instead.

## Out of Scope

- Changing Vercel domain or DNS configuration
- Adding or removing application routes
- Redesigning the frontend
- Submitting or removing Search Console properties
