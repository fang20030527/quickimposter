# Quick Imposter Core MVP Design

## 1. Scope

This implementation delivers the playable local-device MVP described in `docs/PRD.md`:

- Mobile-first English game setup for 3-12 players
- System word pairs with category selection
- Custom words entered by a non-playing host
- Private player-by-player word reveal
- Safe device handoff between players
- Offline discussion instructions
- Protected, staged imposter and civilian-word reveal
- Play again and change settings
- Safe same-tab refresh recovery
- Recent system-pair deduplication

The following PRD items are deferred from this implementation cycle:

- A production set of 300 manually reviewed word pairs
- Word-pair reporting and review operations
- Product analytics and consent management
- Advertising
- Legal, contact, about, and long-form SEO pages
- Hermes review automation

## 2. Product Outcome

The standard path from opening the page to Player 1 seeing a word requires no more than three intentional actions:

1. Select a player count.
2. Select Play.
3. Press and hold to reveal the word.

The game requires no account, download, room, player names, online voting, or scorekeeping. One phone is passed clockwise between players.

## 3. Design Direction

Quick Imposter is a mobile-first party game for English-speaking groups. The selected visual direction is "Energetic Game Show": high-contrast cobalt surfaces, coral accents, strong geometric sans-serif typography, offset composition, and tactile hard-edged controls.

Design dials:

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 5`
- `VISUAL_DENSITY: 5`

The marketing surface uses the `design-taste-frontend` direction. The multi-step game flow uses purpose-built accessible product patterns because secret handling and interaction clarity take priority over decorative composition.

### 3.1 Visual system

- One cobalt and neutral palette with coral as the only accent family
- One soft-square radius system for panels and controls
- Strong sans-serif display type with compact, readable body type
- No decorative gradients, glass effects, or visual status dots
- No theme inversion between ordinary sections
- The secret-word screen uses a darker shade within the same cobalt family to mark a privacy-sensitive moment
- Controls provide visible hover, focus, active, disabled, error, and loading states
- Motion communicates state transitions and input feedback only
- Reduced-motion preferences replace transitions with immediate state changes

### 3.2 Core screens

The settings screen gives the game entry highest visual priority. Player count is a one-tap grid, category is secondary, and Play remains visible without scrolling on common phone viewports.

The private-word screen separates the press-and-hold reveal surface from the completion action. Releasing the reveal surface hides the word immediately. All players receive the same layout, animation, and feedback.

The reveal flow first shows the imposter player and imposter word. The civilian word remains hidden until a second explicit action after the imposter has guessed aloud.

## 4. Architecture

Use a Next.js application with the App Router and pnpm. The playable experience is a client-side state machine rendered within one route. This avoids secret-bearing URLs and makes browser back behavior predictable.

The page shell renders static brand and explanatory content. The interactive game is isolated in a client component. State transitions pass through a reducer so each action is valid only for its expected phase.

Game phases:

1. `setup`
2. `host-handoff`
3. `player-handoff`
4. `secret-view`
5. `discussion`
6. `reveal-hold`
7. `reveal-confirm`
8. `imposter-revealed`
9. `civilian-revealed`

## 5. Component Boundaries

- `GameShell` selects the screen for the current phase and coordinates persistence.
- `SetupScreen` owns player count, category, mode, and custom-word form interactions.
- `PrivacyHandoff` identifies the next player and communicates clockwise passing.
- `SecretWordScreen` owns press-and-hold reveal, accessible toggle mode, and visibility protection.
- `DiscussionScreen` explains offline description and voting rules without exposing identity information.
- `RevealFlow` owns the two-second hold, explicit confirmation, and staged result reveal.
- `ResultActions` starts another game or returns to settings.
- `gameReducer` implements legal state transitions and rejects phase-inappropriate actions.
- `wordRepository` validates word-pair data, filters categories, selects pairs, and applies recent-pair deduplication.
- `sessionStore` serializes and restores only safe same-tab state.

Each function performs one clear operation. Workflow functions coordinate focused helpers instead of mixing selection, persistence, rendering, and validation.

## 6. Data Model and Flow

The game state contains:

- Selected player count
- Selected category or custom mode
- Current player index
- Current game phase
- Selected word-pair ID for system pairs
- Civilian word and imposter word
- Imposter player index
- Whether any player has revealed a word
- Non-sensitive UI notices

The UI derives the current player's word during rendering from the current player and imposter indexes. It does not store a separate identity array.

Starting a game validates settings, chooses a word pair, selects one imposter uniformly from the participating players, and moves to the safe handoff phase. Confirming a handoff makes the next player eligible to enter the secret-view phase. Confirming completion of a secret view increments the player index or moves to discussion after the last player.

Custom words remain inside the current game session and are not added to recent system-pair history. The browser stores only the IDs of the 30 most recently used system pairs in local storage.

## 7. Privacy and Safe Recovery

Secret words and the imposter index never appear in the URL, analytics events, visible logs, or error messages.

The secret word is visible only while the primary reveal control is actively pressed. Releasing pointer, touch, or keyboard activation hides it. An accessible toggle mode is available after a privacy warning.

The secret hides immediately on:

- `visibilitychange` to hidden
- Window blur
- Page hide
- Component unmount

Same-tab recovery uses session storage. A refresh during player distribution always restores to a safe handoff phase. It never restores with a word visible. Closing the tab ends the game because session state is not intentionally restored across a new browsing session.

## 8. Validation and Failure Handling

- Play is disabled until a player count is selected.
- Custom words are trimmed and must each contain 1-40 visible characters.
- Custom words cannot be identical after trimming and case normalization.
- Validation errors appear below the corresponding labeled input.
- Invalid or empty system categories block game start and offer Retry and return-to-settings actions.
- Storage failures do not block play. A small notice explains that repeat avoidance or refresh recovery may be unavailable.
- Changing player count or leaving an active game requires explicit confirmation.
- If any player has viewed a word, the selected system pair is marked as recently used even if the game is cancelled.
- An error boundary provides a safe return to settings without rendering secret state.

## 9. Accessibility

The public UI targets WCAG 2.2 AA:

- Semantic headings, forms, buttons, dialogs, and status messages
- Keyboard access for all actions
- Visible focus indicators
- Minimum 44px touch targets
- Text and control contrast meeting WCAG AA
- Selection never communicated by color alone
- Screen-reader privacy warning before accessible word reveal
- Secret word not placed in an automatic live region
- System text scaling supported without clipped controls
- `prefers-reduced-motion` respected throughout

## 10. Responsive Behavior

The primary target is a phone in portrait orientation. Settings grids and content panels collapse to one column below 768px. Main actions remain reachable without horizontal scrolling. The hero and game entry use `min-height: 100dvh` where viewport-height behavior is needed.

Desktop layouts retain the same interaction order and use a constrained content width. No desktop-only control is required to finish a game.

## 11. Word Data for the MVP

The repository includes a smaller development-quality English word set distributed across the PRD categories. The schema supports expansion to the production requirement of 300 manually reviewed pairs without changing game logic.

Each system pair contains:

- Stable ID
- Category
- Civilian word
- Imposter word

Data validation rejects missing IDs, duplicate IDs, empty words, and identical normalized words before a pair can be selected.

## 12. Testing and Verification

Automated tests cover:

- Every legal reducer transition
- Rejection of phase-inappropriate transitions
- Complete 3-player, 6-player, and 12-player distribution flows
- Imposter-index selection boundaries
- Custom-word validation
- Category filtering and word-data validation
- Recent 30-pair deduplication and fallback to the least-recent pair
- Local and session storage failure degradation
- Refresh recovery to a safe handoff phase
- Blur and visibility-driven secret hiding
- Play again preserving settings while selecting a new pair and imposter

Manual and browser verification covers:

- Phone portrait layout
- Current desktop Chrome and Safari behavior
- Keyboard-only completion
- Screen-reader labels and privacy messaging
- Reduced-motion behavior
- Backgrounding and returning to the page
- Production build and lint/type checks
- Core Web Vitals plausibility, including reserved layout space and minimal above-the-fold JavaScript

## 13. Acceptance Criteria

The MVP is complete when:

- A user can configure and complete a full 3-12 player game on one device.
- No normal interaction, refresh, background event, or staged reveal exposes a previous player's secret.
- System and custom word modes both complete successfully.
- Play again keeps player count and category while rerolling the pair and imposter.
- Core actions work with touch, mouse, and keyboard.
- Automated tests and the production build pass.
- The selected energetic visual direction is consistent across mobile and desktop.
