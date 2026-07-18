# Quick Imposter Online Multiplayer Room Design

## 1. Status and Scope

This design adds an online multiplayer mode beside the existing single-device local mode.

Online mode includes:

- Account-free room creation and joining
- A shareable invitation link
- A synchronized lobby for 3–12 active players
- Server-side word-pair and imposter assignment
- One private word view per player on that player's own device
- Synchronized ready, discussion, staged reveal, and result phases
- Host-controlled replay and room closure
- Reconnection in the same browser
- Automatic closure after host absence or the room lifetime limit
- Homepage redirection for missing, closed, or expired room links

Online mode does not include:

- Accounts, login, profiles, or cross-device identity recovery
- Custom words
- Built-in chat, voice, video, voting, scores, or match history
- Host transfer
- Joining an active round as a participant

The existing local mode and its client-side reducer remain available and behaviorally unchanged.

## 2. Product Decisions

- Every participant, including the room creator, plays without logging in.
- The creator is both the host and an active player.
- Online player count comes from the active lobby roster rather than a preselected count.
- The host can start when 3–12 active players are present.
- A room contains at most 12 non-removed players in total, including players waiting for the next round.
- A player who arrives during an active round may join the room as a waiting player but does not participate until the next lobby.
- Online mode uses only system word pairs. This prevents a participating host from seeing both custom words.
- Discussion and voting happen in person or through an external call. The site only synchronizes game phases.
- Completing a round does not close the room. Players remain on the result screen, and the host may start another round.
- A room closes only when the host explicitly ends it, the host is absent for five consecutive minutes, or the room reaches its six-hour hard lifetime.
- Once a room is closed, any client already inside returns to the homepage and subsequent visits to its invitation link are redirected to the homepage.

## 3. User Flows

### 3.1 Create a room

1. The user changes the homepage game card from `Local` to `Online`.
2. The user enters a nickname and selects a system category.
3. The user selects `Create online room`.
4. The server creates the room, host player, host session, and initial lobby state atomically.
5. The browser receives secure host and player session cookies and navigates to `/game/[roomId]`.
6. The lobby places the invitation link and copy action above the member list.

### 3.2 Join from an invitation

1. A guest opens `/game/[roomId]`.
2. The server redirects to `/` if the room is missing, closed, or expired.
3. An eligible guest sees a minimal join screen with the host nickname, a nickname field, and `No account required` messaging.
4. After validation, the server creates a player session and stores its secure cookie.
5. If the room is in the lobby and has capacity, the player joins the active roster.
6. If a round is active and the total room membership is below 12, the player enters a waiting state and sees `Round in progress`. The player becomes eligible when the host returns the room to the lobby for another round.
7. If the room already contains 12 non-removed players, joining is rejected as full regardless of lifecycle phase.

### 3.3 Play a round

1. The host starts from the lobby.
2. The server snapshots the eligible active roster, selects a word pair, selects one imposter uniformly, and creates all round assignments in one transaction.
3. Each participant fetches only their own assigned word through an authenticated server endpoint.
4. The private screen preserves the existing press-and-hold reveal, focus-loss hiding, and safe refresh behavior.
5. Each participant selects `Ready` after viewing their word.
6. When every snapshotted participant is ready, the server advances the room to discussion.
7. Players discuss and vote outside the site.
8. The host holds and confirms the reveal action.
9. The server first publishes the imposter nickname and imposter word.
10. The host separately reveals the civilian word.
11. All clients show the complete result.

### 3.4 Replay or close

- `Play again` returns the room to the lobby, retains connected players, admits waiting players to the eligible roster, and clears the completed round's client-visible secret state.
- A new round excludes the 30 most recently selected system pair IDs in that room when the chosen category has another option. If every eligible pair is recent, it selects the least-recently used eligible pair. It always rerolls the imposter uniformly.
- `End room` closes the room from any host-controlled phase after confirmation.
- If a snapshotted participant disconnects before becoming ready, the phase remains safe. The host may wait for reconnection or cancel the round back to the lobby after confirmation; the incomplete round is discarded and never partially reused.

## 4. Routes and Page Structure

### `/`

The existing homepage remains canonical and indexable. Its game card gains a `Local / Online` switch:

- `Local` renders the existing player-count, random/custom word, and local Play flow.
- `Online` renders host nickname, system category, and `Create online room`.

Marketing claims that currently say no online room is required must be revised so they remain true for local mode without implying that online rooms do not exist.

### `/game/[roomId]`

This is a dynamic, non-indexable game route. Its server entry checks room existence and lifecycle before rendering:

- Missing, closed, or expired: `redirect("/")`
- Valid room with a matching session cookie: restore that player and render the current safe phase
- Valid room without a session cookie: render join or active-round waiting entry

The route sets noindex metadata and is excluded from the sitemap. Robots rules may disallow the route as defense in depth, but authorization and unguessable identifiers do not depend on robots behavior.

## 5. Application Architecture

The recommended deployment is Vercel Fluid Compute plus Neon Postgres.

- Next.js renders pages and owns all room, mutation, heartbeat, and secret-reading endpoints.
- Neon Postgres is the authoritative room state store.
- The server uses `pg` with a process-level pool registered through `attachDatabasePool` from `@vercel/functions`. Vercel receives a pooled `DATABASE_URL`; schema migrations use a separate direct `DATABASE_URL_UNPOOLED`.
- Versioned SQL files live under `db/migrations/`, are applied in lexical order through the direct connection, and are recorded with a checksum in a migration ledger so an applied file cannot change silently.
- Core room tables live in a `private` schema. The runtime application role has no direct table privileges and may execute only the approved transaction functions.
- Transaction functions that need table access are `SECURITY DEFINER`, owned by the migration role, use a fixed safe `search_path`, schema-qualify data access, and have `PUBLIC` execution revoked.
- The browser receives no Neon connection string or database credential. It synchronizes through sanitized Next.js snapshots and never connects directly to Postgres.
- Foreground clients poll the room version every second. An unchanged version returns `204`; a changed version returns a fresh sanitized snapshot. Background tabs poll every five seconds.
- A request-triggered cleanup function enforces host absence and room expiry before room data is returned. Vercel Cron is an optional backlog-cleanup supplement, not a correctness dependency.
- Direct anonymous clients cannot select or mutate secret-bearing room, round, assignment, or session tables.

The browser never treats local state as authoritative. It renders the most recent server snapshot and resynchronizes after reconnecting or encountering a version conflict.

Before implementation, dependencies must be installed and the relevant local Next.js 16.2 documentation under `node_modules/next/dist/docs/` must be read for dynamic routes, Route Handlers, cookies, redirects, caching, and metadata. The implementation must follow those local docs rather than older framework conventions.

## 6. Component and Module Boundaries

- `GameModeSetup`: selects Local or Online on the homepage and delegates to the correct setup form.
- `OnlineSetup`: validates the host nickname and category and requests room creation.
- `OnlineRoomController`: consumes synchronized room snapshots, manages reconnect state, and selects the screen for the authoritative phase.
- `JoinRoomScreen`: validates and submits a guest nickname without owning lobby behavior.
- `LobbyScreen`: renders invitation copying, roster state, waiting players, and host-only start controls.
- `OnlineSecretScreen`: adapts the existing private reveal interaction to a server-provided personal word.
- `OnlineDiscussionScreen`: renders shared discussion instructions and host-only reveal initiation.
- `OnlineRevealFlow`: renders the staged public result and host-only transitions.
- `room-service`: implements create, join, start, ready, reveal, replay, cancel, heartbeat, and close commands.
- `neon-pool`: owns the server-only `pg` pool and Vercel Fluid lifecycle registration.
- `room-repository`: contains focused Postgres function calls and result mapping.
- `room-session`: creates, parses, and hashes host/player capability tokens.
- `room-cookies`: stores, reads, and clears room-scoped capability cookies.
- `use-room-sync`: owns foreground/background polling, version checks, retry backoff, and focus/network recovery.

Existing local components may contribute small presentational primitives, but online orchestration must not be added to the local `gameReducer` or `sessionStore`.

## 7. Authoritative State Machine

Room lifecycle states:

1. `lobby`
2. `private-reveal`
3. `discussion`
4. `imposter-revealed`
5. `civilian-revealed`
6. `closed`

The `civilian-revealed` state is the completed-round result. `Play again` transitions it to `lobby`; `End room` transitions any host-controlled active state to `closed`.

Every mutation includes the client's last observed room version. The database transaction verifies:

- The supplied session and required host/player permission
- The room is open and unexpired
- The current lifecycle state permits the command
- The expected version matches
- The acting player belongs to the current round when required

Successful commands increment the version exactly once. The command response triggers an immediate snapshot refresh rather than waiting for the next polling interval. Stale or duplicate commands return a conflict response, after which the client also refetches the snapshot.

## 8. Data Model

### `rooms`

- Public random room ID
- Lifecycle status and monotonically increasing version
- Selected category
- Current round ID
- Host player ID
- Host last-seen timestamp
- Created, updated, closed, and hard-expiry timestamps

### `players`

- Player ID and room ID
- Display nickname and normalized nickname
- Join order
- Active, waiting, disconnected, or removed state
- Last-seen timestamp
- Created timestamp

### `room_sessions`

- Session ID, room ID, and player ID
- Player-token hash
- Optional host-token hash
- Expiry and revocation timestamps

Raw session tokens are never stored in the database.

### `rounds`

- Round ID and room ID
- Lifecycle phase and version
- Selected word-pair ID plus server-only civilian and imposter values
- Server-only imposter player ID
- Started, completed, cancelled, and reveal timestamps

### `round_players`

- Round ID and player ID
- Immutable participation order
- Server-only civilian/imposter assignment
- Ready timestamp

### Version synchronization

The client sends its last observed room version to the snapshot endpoint. The endpoint performs lifecycle cleanup, verifies room visibility, and returns `204` when the authoritative version is unchanged. When the version changes, it returns a no-store sanitized snapshot. Foreground tabs check every second; hidden tabs check every five seconds. A successful command, browser focus, restored network connection, or retry recovery causes an immediate check. Repeated failures use bounded exponential backoff. The snapshot endpoint remains the only source for shared room state.

## 9. Identity, Privacy, and Security

- Room IDs use at least 128 bits of cryptographically secure randomness and are not sequential.
- Player and host session tokens use at least 256 bits of cryptographically secure randomness.
- Tokens are stored in Secure, HttpOnly, SameSite cookies scoped as narrowly as the framework permits.
- The database stores only SHA-256 token digests. The server hashes presented capability tokens before a transaction function compares them with stored digests; raw tokens never reach Postgres. The tokens contain at least 256 bits of random entropy.
- Host commands require both the player session and host capability.
- Player commands can fetch only the acting player's word and update only the acting player's ready state.
- A sanitized room snapshot exposes nicknames, connection/waiting state, ready counts, lifecycle phase, version, and results only after the corresponding reveal phase.
- Before reveal, no API, event, URL, analytics call, log, or client bundle state contains the selected pair or imposter identity for unrelated players.
- Nicknames are rendered as text, never interpreted as markup.
- Nicknames are trimmed, contain 2–20 visible characters, and are unique among non-removed room members after case-insensitive normalization.
- Room creation, joining, snapshot, secret fetch, and mutation endpoints have per-IP/session rate limits and bounded request bodies.
- All mutations use schema validation and database constraints in addition to UI validation.
- Neon credentials exist only in server environment variables. No database value uses a `NEXT_PUBLIC_` prefix.
- The migration role uses the direct connection only for schema operations. The runtime application role cannot read tables and can execute only explicitly granted functions.

## 10. Presence, Reconnection, and Expiry

- Active room clients send a lightweight authenticated heartbeat approximately every 15 seconds. Snapshot polling is read-only, and persisted heartbeat timestamps decide lifecycle transitions.
- Refreshing or briefly disconnecting in the same browser restores the player through the session cookie.
- A disconnected participant remains in the current immutable round snapshot so reconnection cannot change role distribution.
- Outside an active round, a non-host player who remains disconnected for five minutes is marked removed and stops consuming one of the 12 room slots. A returning browser may join again if capacity remains.
- A disconnected host causes other players to see a waiting banner and five-minute countdown.
- Every room read or mutation invokes cleanup before returning data. Cleanup closes the room when the authenticated host heartbeat has been absent for five consecutive minutes.
- Every room has a six-hour hard expiry measured from creation, even if heartbeats continue.
- Closing revokes sessions and clears unrevealed secret assignment data while retaining a minimal closed-room tombstone long enough for deterministic homepage redirection.
- An optional Vercel Cron job removes old tombstones and stale rate-limit buckets in the background. Correct redirects and room closure do not depend on its schedule.

## 11. Failure Handling

- During network loss, the client keeps the current safe screen, displays reconnect status, and disables state-changing controls.
- Reconnection always fetches a new snapshot before re-enabling commands.
- Poll failures keep the last safe snapshot visible and use bounded exponential backoff. Browser focus and restored connectivity trigger an immediate retry.
- Full room, duplicate nickname, validation failure, unauthorized session, stale version, and temporarily unavailable service receive distinct user-safe responses.
- Transactions make room creation, round creation, assignment, ready-to-discussion advancement, reveal, replay, cancellation, and closure atomic.
- The client never optimistically shows a secret or reveal result.
- Unknown, closed, and expired routes redirect server-side to `/`. A room that closes while open triggers a client-side replace navigation to `/`.
- Logs contain event type, opaque IDs, version, and failure category but never raw tokens, nicknames, word values, or role assignments.

## 12. SEO and Analytics Boundaries

- `/game/[roomId]` is excluded from the sitemap and marked noindex.
- Room IDs, nicknames, words, player roles, and session identifiers are never sent to Plausible, Google Analytics, advertising scripts, or structured data.
- The online game route should not load advertising scripts during private or active game phases.
- Homepage copy and FAQ entries are updated to distinguish instant local play from optional online rooms.

## 13. Testing and Verification

### Unit tests

- Nickname and room input validation
- Legal and illegal lifecycle transitions
- Host and player permission checks
- Expected-version conflict behavior
- Uniform imposter selection boundaries
- Snapshot redaction by phase
- Expiry and host-absence decisions
- Safe reconnect and secret-view recovery

### Database integration tests

- Apply every committed SQL migration to a dedicated Neon test branch through the direct connection.
- Atomic room and round creation
- Concurrent join behavior and the 12-player limit
- Case-insensitive nickname uniqueness
- One imposter per round and immutable round roster
- Idempotent ready and reveal commands
- Session revocation and token isolation
- Runtime-role inability to read secret-bearing tables and inability to execute unapproved functions
- Closed-room tombstone and cleanup behavior

### Component tests

- Local/Online switching without changing local setup behavior
- Create, join, copy link, lobby roster, waiting state, and host controls
- Private reveal privacy events and Ready behavior
- Foreground/background polling, unchanged-version `204`, retry backoff, focus recovery, host-away countdown, conflicts, and service errors
- Staged public reveal and result actions

### Multi-browser end-to-end tests

- Complete three-player online round
- Joining an active round and entering the next lobby
- Refreshing each phase without changing identity or exposing secrets
- Participant disconnect and host round cancellation
- Host disconnect/reconnect inside five minutes
- Host absence timeout and six-hour expiry
- Explicit room closure and old-link homepage redirect
- Simultaneous commands resolving to one authoritative transition

The database suite runs against an isolated Neon branch, while unit and component tests use deterministic repository boundaries. The final verification gate runs database integration tests, lint, all application tests, and a production build. Existing local-mode tests must remain green.

## 14. Acceptance Criteria

The online mode is complete when:

- A host can create a room without an account, copy its link, and start with 3–12 active players.
- Guests can join from the link with only a valid nickname.
- Every current-round participant receives exactly one private word on their own device, and no client can read another participant's unrevealed assignment.
- All clients converge on the same authoritative phase within the confirmed polling window through disconnects, refreshes, duplicate requests, and concurrent commands.
- Late arrivals do not affect an active round and can participate in the next one.
- The host can stage the reveal, replay through the lobby, cancel a blocked round, or close the room.
- Host absence and hard expiry close the room according to the confirmed limits.
- Closed, expired, and nonexistent invitation links redirect to the homepage.
- Online room data is absent from analytics, advertisements, URLs beyond the opaque room ID, and user-visible logs.
- Local mode remains functionally unchanged.
