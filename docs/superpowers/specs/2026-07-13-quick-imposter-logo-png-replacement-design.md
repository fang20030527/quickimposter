# Quick Imposter Logo PNG Replacement Design

## Goal

Use the supplied `ChatGPT Image 2026年7月13日 17_47_57.png` as the website logo exactly as provided, replacing the experimental SVG replica that introduced unwanted color artifacts.

## Changes

- Replace `public/quick-imposter-logo.png` with the newly supplied 1254 × 1254 PNG.
- Restore `src/components/brand-logo.tsx` to its local static PNG import.
- Remove `public/quick-imposter-logo.svg` because it will no longer be used.
- Preserve the existing `BrandLogo` component API, dimensions, accessibility behavior, and surrounding layout.

## Verification

- Confirm the copied public asset matches the supplied file byte-for-byte.
- Confirm the logo remains 1254 × 1254 and renders at the existing navigation and hero sizes.
- Run tests, lint, and a production build.

## Acceptance Criteria

- The website displays the newly supplied PNG without SVG color artifacts.
- No source file references `quick-imposter-logo.svg`.
- Existing page layout and logo dimensions remain unchanged.
