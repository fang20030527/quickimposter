# Quick Imposter Logo SVG Replica Design

## Goal

Replace the current raster `quick-imposter-logo.png` with a high-fidelity, self-contained SVG replica of the supplied 1254 × 1254 logo artwork. The replacement must preserve the current navigation and hero layout while remaining sharp at any display size.

## Scope

- Create `public/quick-imposter-logo.svg` with a `0 0 1254 1254` view box.
- Preserve the original square composition, transparent background, and lower whitespace.
- Recreate the white sticker border, navy outer contour, pink-and-purple imposter, facial features, magnifying glass, yellow lightning motif, purple accent marks, and two-line wordmark.
- Replace the PNG import in `src/components/brand-logo.tsx` with the SVG asset.
- Preserve the existing component API, rendered dimensions, accessibility behavior, and surrounding CSS layout.

## Vector Construction

The logo will be drawn manually as layered SVG geometry. All visible lettering will be represented by Bézier paths rather than live text so that the appearance does not depend on installed fonts. Gradients will reproduce the yellow-to-orange and purple-to-pink color transitions. SVG filters may provide soft drop shadows, but the main dimensional outlines will remain explicit vector paths so they stay crisp at small sizes.

The SVG will not embed raster images, scripts, external fonts, or remote resources. Decorative effects must remain self-contained in the file.

## Layer Order

1. Soft outer drop shadow.
2. White sticker silhouette.
3. Deep navy silhouette and dimensional wordmark extrusion.
4. Imposter hood and face.
5. Eyes, grin, hand, magnifying glass, sparkle, and accent rays.
6. Yellow `Quick` wordmark and orange depth faces.
7. Purple-pink `Imposter` wordmark and darker depth faces.
8. Small highlights that improve separation and legibility.

## Integration

`BrandLogo` will continue to render through `next/image`. The source will point to `/quick-imposter-logo.svg`; because SVG files do not benefit from raster optimization, the component will use the documented unoptimized SVG behavior. No permissive `dangerouslyAllowSVG` configuration is required for this trusted local public asset.

## Verification

- Parse the SVG to catch malformed markup.
- Render the SVG to a PNG preview at the source dimensions.
- Compare the rendered preview with the supplied reference for overall silhouette, color balance, wordmark placement, facial expression, and magnifying-glass proportions.
- Check the logo at the existing 48 px navigation size and 148 px hero size to ensure the face and wordmark remain recognizable.
- Run the relevant component/page tests and project checks after changing the asset reference.

## Acceptance Criteria

- The page uses `public/quick-imposter-logo.svg` instead of the PNG logo.
- The SVG is composed only of vector geometry, gradients, masks/clips, and SVG filters.
- It closely matches the supplied artwork in composition, palette, depth, and character expression.
- Existing navigation and hero logo dimensions remain unchanged.
- The SVG renders without missing resources or browser console errors.
