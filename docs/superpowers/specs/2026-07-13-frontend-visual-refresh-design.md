# Quick Imposter Frontend Visual Refresh Design

**Date:** 2026-07-13  
**Status:** Approved  
**Reference:** `design.pen` and the exported desktop/mobile prototype images in `design-exports/`

## Goal

Refresh the full Quick Imposter frontend so the landing page and setup experience closely match the supplied Pencil prototype, then extend the same visual language across every playable game state. Preserve the existing game logic, content, privacy behavior, accessibility, storage behavior, and SEO structure.

## Chosen Approach

Use a high-fidelity responsive implementation rather than a fixed-size replica or a broad component-library rewrite.

- Match the prototype closely at its representative desktop and mobile sizes.
- Use fluid layout primitives and purposeful breakpoints so intermediate viewport sizes remain usable.
- Reuse the prototype's visual system across the states not explicitly represented in `design.pen`.
- Avoid unrelated architecture or gameplay changes.

## Page Structure and Responsive Behavior

### Landing and setup

On desktop, retain the prototype's two-column composition. The left column contains the branded hero, benefit cards, and how-to-play content. The right column contains the game setup card and privacy card. The FAQ and footer close the page horizontally.

On mobile, use the prototype's vertical reading order:

1. Brand headline
2. Game setup card
3. Three benefits
4. How-to-play steps
5. Privacy explanation
6. FAQ
7. Footer

The implementation must use CSS Grid, flex layout, fluid type and container constraints rather than absolute positioning copied from the design canvas. It should support viewports from 320px through wide desktop without horizontal overflow.

### Active game

After the game begins, the interface enters a focused mode. Long-form marketing content is visually de-emphasized or removed from the immediate game viewport, the current stage is centered, and a compact brand presence remains. A clear route back to settings is available where the game flow permits it.

Representative validation sizes are 1536×1024 for desktop and 397×992 CSS pixels for mobile, matching the supplied exports.

## Visual System

### Direction

The interface should feel playful, bold, and game-like without becoming noisy during secret interactions. The memorable motif is the combination of deep navy outlines, energetic purple branding, bright yellow calls to action, and layered offset shadows.

### Color roles

- Deep navy: primary text, outlines, icon details, and hard shadows
- Brand purple: identity, labels, selected accents, and supporting illustrations
- Bright yellow: primary actions and selected states
- Pale lavender: borders, background atmosphere, and secondary surfaces
- White or near-white: card surfaces and breathing room

Colors must be exposed through CSS custom properties so every stage uses consistent semantic roles.

### Typography

Headings use a heavy, rounded, characterful display treatment that matches the prototype. Body copy uses a calmer, highly legible companion. Existing local or bundled font support should be preferred over a new render-blocking dependency. Type sizes remain fluid and must accommodate the existing English copy without clipping.

### Components

The following elements share a consistent visual grammar:

- Primary and secondary buttons
- Player-count cells and selected badges
- Word-source segmented controls
- Selects and text inputs
- Benefit cards and instructional step cards
- Status notices and validation errors
- Stage panels and result cards
- FAQ disclosures

Selected states use more than color: a check badge, outline or shadow change, and appropriate ARIA state remain visible. Icons should reuse existing prototype assets where supplied and the installed Phosphor icon set elsewhere.

### Motion

Motion is limited to high-value moments: initial entry, stage transitions, press feedback, and the existing hold-to-reveal progress. Decorative perpetual motion is excluded. All effects respect `prefers-reduced-motion`.

## Full Game Flow Extension

The states not depicted in the prototype inherit the same visual language with lower decorative density:

- **Host and player handoff:** prominent player number, phone/pass illustration, concise privacy instruction, yellow continuation action
- **Secret word:** deep-purple secret surface, strong player context, explicit hold interaction, and immediate privacy feedback
- **Discussion:** structured instruction card with restrained iconography and a clear reveal action
- **Reveal confirmation:** high-contrast warning treatment with deliberately separated cancel and confirm actions
- **Imposter and civilian results:** large typographic reveals using the same card, border, and shadow system
- **Recovery and storage errors:** branded but calm notice or error cards that do not expose secret information

The game stage must prioritize privacy and the next action over decorative artwork.

## Component and State Boundaries

The existing reducer, word repository, recent-pair behavior, session recovery, and phase transitions remain unchanged. Each game phase continues to be owned by its current focused component. Keep the shared presentation in CSS and the existing `game-experience` container; do not add a new wrapper component unless implementation reveals duplicated semantic markup in at least three phase components.

Primary implementation areas are:

- `src/app/page.tsx` for responsive page composition and focused-game presentation hooks
- `src/app/globals.css` for tokens, responsive layout, component styling, and motion
- Existing components under `src/components/game/` for minimal semantic markup needed by the new visuals
- Existing brand and illustration components/assets for prototype fidelity

No new data flow, server endpoint, persistent storage contract, or gameplay feature is required.

## Error Handling and Accessibility

- Preserve current custom-word validation, storage warnings, restore failures, and safe fallback behavior.
- Restyle errors and notices without changing their meaning or ARIA roles.
- Maintain keyboard access, visible focus indicators, correct disabled states, and sufficiently large touch targets.
- Do not use color alone to communicate selection, error, or game status.
- Preserve the privacy behavior that hides secret words on release, loss of focus, visibility changes, and related protected transitions.
- Prevent text clipping and horizontal overflow at supported widths.

## Verification

Run the existing automated checks:

- Vitest test suite
- ESLint
- Next.js production build

Perform browser verification for:

- Desktop landing/setup at 1536×1024
- Mobile landing/setup near 397×992
- At least one intermediate tablet width
- Setup in both random and custom-word modes
- Host handoff and player handoff
- Hold-to-reveal secret view
- Discussion
- Reveal confirmation
- Imposter reveal and civilian-word reveal
- Storage notice and restore error presentation where practical
- Keyboard focus, reduced motion, and horizontal overflow

## Acceptance Criteria

1. The prototype-covered landing and setup areas are recognizably high-fidelity at the target desktop and mobile sizes.
2. Every game phase uses a coherent extension of the purple, yellow, navy, lavender, outlined-card visual system.
3. Existing gameplay, privacy, validation, recovery, SEO content, and accessibility behavior do not regress.
4. The layout remains usable without horizontal overflow from 320px through wide desktop.
5. Existing tests, lint, and production build pass.

## Out of Scope

- Gameplay or copy changes
- New backend services, accounts, rooms, or multiplayer networking
- Reworking the reducer or persistence contracts
- A standalone general-purpose design-system package
- Pixel-perfect absolute positioning at only the two prototype canvas sizes
