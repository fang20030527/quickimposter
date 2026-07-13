# Indexable Site Structure

Quick Imposter currently has one public, canonical page:

| Route | Canonical URL | Sitemap |
| --- | --- | --- |
| `/` | `https://www.quickimposter.org` | Included |

Next.js metadata endpoints (`/sitemap.xml`, `/robots.txt`, icons, and Open Graph images) are not content pages and are excluded from the sitemap.

## Adding a Route

Add a route to `src/app/sitemap.ts` only when it is:

- Public and intended for search indexing
- Available at its canonical HTTPS URL
- Returning a successful response without a redirect
- Backed by unique page content rather than a placeholder

Do not add `priority` or `changeFrequency`; Google ignores both fields. Add `lastModified` only when the route has a reliable content modification date.
