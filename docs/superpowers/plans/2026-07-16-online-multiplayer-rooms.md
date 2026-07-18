# Quick Imposter Neon Online Multiplayer Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add account-free Neon-backed online rooms where 3–12 players join by link, receive one private word each, synchronize within one second while active, and return to the homepage after the room closes.

**Architecture:** Keep the current local reducer untouched. Next.js 16 Route Handlers own cookies, validation, rate limiting, and all authoritative commands; Neon Postgres stores state in a private schema behind least-privilege transaction functions. Vercel Fluid Compute uses a server-only pg pool, and clients use version-aware one-second foreground polling with five-second background polling.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5.9, Zod 4.4.3, pg 8.22.0, @vercel/functions 3.7.5, postgres-migrations 5.3.0, Neon Postgres, Vitest 4.1.10, Testing Library 16.3, Playwright 1.61.1, pnpm 10.

## Global Constraints

- No participant logs in; nickname and room-scoped HttpOnly capability cookies are the only identity.
- The host is also a player; a room accepts 3–12 non-removed players.
- The invitation route is /game/[roomId]; missing, closed, and expired rooms redirect to /.
- Online mode uses only system word pairs and never changes the existing local game reducer or local persistence.
- The host alone starts, reveals, replays, cancels, and ends rounds; host absence closes the room after five minutes.
- Every room expires six hours after creation.
- Foreground synchronization checks every 1,000 ms; hidden tabs check every 5,000 ms; authenticated heartbeats run every 15,000 ms.
- The browser receives no Neon credential. DATABASE_URL is the pooled runtime-role connection; DATABASE_URL_UNPOOLED is the direct migration-role connection.
- The runtime role has no direct table privileges and may execute only approved private transaction functions.
- SQL migrations are immutable, consecutive files under db/migrations and are applied only through DATABASE_URL_UNPOOLED.
- No raw capability, nickname, room ID, word, or role enters analytics, advertising requests, or user-visible logs.
- Read the relevant guides in node_modules/next/dist/docs before changing any Next.js API.
- Use TDD vertical slices, one failing behavior followed by the minimum implementation.
- Stage only the files named by the current task, review the staged diff, commit, and push each accepted increment.

## Completed Baseline

The branch already contains and must preserve:

- 254fa63: room domain types, Zod validation, nickname normalization, room IDs, command types, pinned Zod/server-only/Playwright dependencies, and the initial environment template.
- 867854b: capability generation/parsing/hashing, secure room cookies, and temporary Supabase client boundaries.
- 559c98b: the approved Neon architecture in docs/superpowers/specs/2026-07-16-online-multiplayer-room-design.md.

The temporary files src/online/supabase-admin.ts and src/online/supabase-browser.ts are removed in Task 1. The capability and cookie modules remain.

## File Map

**Database and deployment**

- db/migrations/00001_online_room_schema.sql: private tables, checks, indexes, and the no-login quickimposter_app privilege role.
- db/migrations/00002_online_room_lobby_functions.sql: create, join, snapshot, heartbeat, request cleanup, and rate-limit functions.
- db/migrations/00003_online_round_functions.sql: secret, start, ready, reveal, replay, cancel, and close functions.
- db/migrations/00004_online_room_cleanup.sql: global stale-room and retention cleanup.
- db/integration/database-test-utils.ts: owner connection, migration, fixtures, role switching, and cleanup helpers.
- db/integration/online-room-schema.test.ts: schema and least-privilege assertions.
- db/integration/online-room-lobby.test.ts: lobby concurrency, redaction, heartbeat, and rate-limit behavior.
- db/integration/online-rounds.test.ts: atomic round transitions and secret isolation.
- scripts/migrate.mjs: direct-connection SQL migration runner.
- vitest.db.config.mts: isolated Node integration-test configuration.
- vercel.json: daily best-effort retention cleanup.

**Server domain**

- src/online/neon-pool.ts: lazy server-only pg pool and Vercel Fluid lifecycle registration.
- src/online/room-repository.ts: one focused Postgres function call per method.
- src/online/room-service.ts: workflow coordination, capability hashing, system word selection, and safe error mapping.
- src/online/request-rate-limit.ts: HMAC request/session identity.

**HTTP**

- src/app/api/online/rooms/route.ts: create room.
- src/app/api/online/rooms/[roomId]/route.ts: version-aware snapshot.
- src/app/api/online/rooms/[roomId]/join/route.ts: join room.
- src/app/api/online/rooms/[roomId]/secret/route.ts: acting-player secret.
- src/app/api/online/rooms/[roomId]/commands/route.ts: authoritative room command.
- src/app/api/online/rooms/[roomId]/heartbeat/route.ts: presence heartbeat.
- src/app/api/online/cleanup/route.ts: CRON_SECRET-protected retention cleanup.

**UI**

- src/components/game/game-mode-setup.tsx: local/online choice.
- src/components/game/online-setup.tsx: create-room form.
- src/app/game/[roomId]/page.tsx: dynamic noindex server entry.
- src/components/online/online-room-controller.tsx: snapshot, command, heartbeat, and phase orchestration.
- src/components/online/use-room-sync.ts: serialized version polling, visibility cadence, and retry backoff.
- src/components/online/join-room-screen.tsx: account-free joining.
- src/components/online/lobby-screen.tsx: invitation, roster, and host start.
- src/components/online/online-secret-screen.tsx: personal word and ready action.
- src/components/online/online-discussion-screen.tsx: discussion and host reveal.
- src/components/online/online-reveal-flow.tsx: staged result, replay, and close.

---

### Task 1: Replace Temporary Supabase Boundaries with the Neon Pool

**Files:**

- Modify: package.json
- Modify: pnpm-lock.yaml
- Modify: .env.example
- Delete: src/online/supabase-admin.ts
- Delete: src/online/supabase-browser.ts
- Create: src/online/neon-pool.ts
- Create: src/online/neon-pool.test.ts
- Modify: src/online/room-session.test.ts

**Interfaces:**

- Produces: getDatabasePool(): Pool.
- Consumes: server-only DATABASE_URL and Vercel Fluid Compute.
- Preserves: every room-session and room-cookie public function from commit 867854b.

- [ ] **Step 1: Pin Neon runtime and migration dependencies**

Run:

~~~bash
pnpm remove @supabase/supabase-js
pnpm add pg@8.22.0 @vercel/functions@3.7.5
pnpm add -D @types/pg@8.20.0 postgres-migrations@5.3.0
~~~

Expected: package.json contains no Supabase dependency, and pnpm-lock.yaml records the exact versions above.

- [ ] **Step 2: Write the failing lazy-pool tests**

Create src/online/neon-pool.test.ts with mocked Pool and attachDatabasePool. Assert that importing the module does not read environment variables, missing DATABASE_URL throws Neon database environment is not configured, two calls return the same Pool, and attachDatabasePool is called exactly once.

~~~ts
it("creates and registers one pool lazily", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://runtime:secret@host/db?sslmode=require");
  const first = getDatabasePool();
  const second = getDatabasePool();
  expect(first).toBe(second);
  expect(PoolMock).toHaveBeenCalledOnce();
  expect(attachDatabasePoolMock).toHaveBeenCalledWith(first);
});
~~~

Remove Supabase mocks and client assertions from room-session.test.ts while keeping all ten capability and cookie behaviors.

Run: pnpm exec vitest run src/online/neon-pool.test.ts src/online/room-session.test.ts

Expected: FAIL because neon-pool.ts does not exist.

- [ ] **Step 3: Implement one focused lazy pool boundary**

~~~ts
import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

let pool: Pool | null = null;

export function getDatabasePool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Neon database environment is not configured");
  }
  pool = new Pool({ connectionString, max: 5 });
  attachDatabasePool(pool);
  return pool;
}
~~~

Delete both Supabase client modules. Update .env.example to:

~~~dotenv
DATABASE_URL=postgresql://quickimposter_runtime:replace_me@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:replace_me@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_TEST=postgresql://neondb_owner:replace_me@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
ROOM_RATE_LIMIT_SECRET=replace_with_32_random_bytes
CRON_SECRET=replace_with_32_random_bytes
~~~

- [ ] **Step 4: Verify the boundary and build safety**

Run:

~~~bash
pnpm exec vitest run src/online/neon-pool.test.ts src/online/room-session.test.ts
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
~~~

Expected: focused and full tests pass, production build succeeds without database variables, and no repository file contains @supabase or SUPABASE_.

- [ ] **Step 5: Commit and push**

~~~bash
git add package.json pnpm-lock.yaml .env.example src/online/neon-pool.ts src/online/neon-pool.test.ts src/online/room-session.test.ts
git rm src/online/supabase-admin.ts src/online/supabase-browser.ts
git commit -m "replace Supabase clients with Neon"
git push origin agent/online-multiplayer-design
~~~

### Task 2: Add Reproducible Neon Migrations and the Private Schema

**Files:**

- Modify: package.json
- Create: scripts/migrate.mjs
- Create: vitest.db.config.mts
- Create: db/migrations/00001_online_room_schema.sql
- Create: db/integration/database-test-utils.ts
- Create: db/integration/online-room-schema.test.ts

**Interfaces:**

- Produces: pnpm db:migrate, pnpm test:db, ownerPool(), withRuntimeRole(), resetDatabase().
- Produces tables: private.rooms, private.players, private.room_sessions, private.rounds, private.round_players, private.rate_limit_buckets.
- Produces no-login privilege role: quickimposter_app.
- Consumes: direct DATABASE_URL_UNPOOLED for migrations and direct DATABASE_URL_TEST for integration tests.

- [ ] **Step 1: Provision an isolated Neon development branch**

Use Neon MCP to list organizations and projects. Reuse a dedicated quickimposter project when present; otherwise create quickimposter in the organization selected by the user. Create branch online-multiplayer-dev from main. Retrieve the direct owner connection for that branch and store it only in untracked .env.local as DATABASE_URL_UNPOOLED and DATABASE_URL_TEST. Do not print or commit either value.

Expected: the branch is ACTIVE, both variables point to a non-pooler host, and git status does not show .env.local.

- [ ] **Step 2: Implement the migration command**

Add package scripts:

~~~json
{
  "db:migrate": "node scripts/migrate.mjs",
  "test:db": "vitest run --config vitest.db.config.mts"
}
~~~

Create scripts/migrate.mjs:

~~~js
import pg from "pg";
import { migrate } from "postgres-migrations";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL_TEST;
if (!connectionString) throw new Error("Direct Neon database URL is required");
if (new URL(connectionString).hostname.includes("-pooler.")) {
  throw new Error("Migrations require a direct Neon connection");
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await migrate({ client }, "db/migrations");
} finally {
  await client.end();
}
~~~

Create vitest.db.config.mts with Node environment and include db/integration/**/*.test.ts only.

- [ ] **Step 3: Write failing schema and privilege tests**

The database helper must connect as owner, delete data in foreign-key order between tests, and execute SET LOCAL ROLE quickimposter_app inside a transaction for privilege checks.

~~~ts
it("denies runtime-role table reads", async () => {
  await expect(
    withRuntimeRole((client) => client.query("select * from private.room_sessions")),
  ).rejects.toMatchObject({ code: "42501" });
});

it("creates all private tables and constraints", async () => {
  const rows = await ownerPool().query(
    "select table_name from information_schema.tables where table_schema = 'private' order by table_name",
  );
  expect(rows.rows.map((row) => row.table_name)).toEqual([
    "players", "rate_limit_buckets", "room_sessions", "rooms",
    "round_players", "rounds",
  ]);
});
~~~

Run: pnpm test:db

Expected: FAIL because the schema migration is absent.

- [ ] **Step 4: Create the exact private schema**

00001_online_room_schema.sql must:

- create schema private and revoke all on schema private from public;
- create role quickimposter_app nologin when it does not exist;
- grant only usage on schema private to quickimposter_app;
- create the six tables listed above with primary keys, foreign keys, timestamps, and checks matching RoomPhase, PlayerState, 64-character lowercase digest values, six-hour expiry, and one assignment per round/player;
- add a partial unique index on (room_id, normalized_nickname) where state <> 'removed';
- add indexes for room membership, session lookup, active-round lookup, heartbeat cleanup, expiry cleanup, and rate-bucket expiry;
- revoke all table and sequence privileges from public and quickimposter_app;
- add table comments stating that raw capability tokens must never be stored.

Use text plus CHECK constraints for lifecycle values so later migrations can add states without enum replacement.

- [ ] **Step 5: Apply and verify the migration**

Run:

~~~bash
pnpm db:migrate
pnpm test:db
pnpm exec vitest run
pnpm lint
git diff --check
~~~

Expected: postgres-migrations records migration 1 and its checksum, all schema tests pass, and changing an applied migration causes the runner to reject the checksum.

- [ ] **Step 6: Commit and push**

~~~bash
git add package.json scripts/migrate.mjs vitest.db.config.mts db/migrations/00001_online_room_schema.sql db/integration/database-test-utils.ts db/integration/online-room-schema.test.ts
git commit -m "add Neon online room schema"
git push origin agent/online-multiplayer-design
~~~

### Task 3: Implement Atomic Lobby Functions and the Repository

**Files:**

- Create: db/migrations/00002_online_room_lobby_functions.sql
- Create: db/integration/online-room-lobby.test.ts
- Create: src/online/room-repository.ts
- Create: src/online/room-repository.test.ts

**Interfaces:**

- Produces database functions: private.create_online_room, private.join_online_room, private.get_online_room_snapshot, private.heartbeat_online_room, private.check_online_rate_limit, private.cleanup_online_room.
- Produces: createRoomRepository(pool?): createRoom, joinRoom, getSnapshot, heartbeat, checkRateLimit.
- Snapshot result: { changed: false, version: number } or { changed: true, snapshot: RoomSnapshot }.

- [ ] **Step 1: Write one failing lobby integration slice**

Create fixtures with valid room, player, and session JSON. First test create_online_room as quickimposter_app and assert one room, one host player, one session, phase lobby, and version 0. Then add one behavior at a time for duplicate normalized nickname, 13th player rejection, active-round waiting state, unchanged-version response, snapshot redaction, heartbeat authorization, five-minute host cleanup, and fixed-window rate limits.

~~~ts
it("serializes concurrent joins for the final slot", async () => {
  await seedRoomWithPlayers(11);
  const results = await Promise.allSettled([
    joinAs("Maya", "maya"),
    joinAs("Noah", "noah"),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toEqual([
    expect.objectContaining({ reason: expect.objectContaining({ message: "room-full" }) }),
  ]);
});
~~~

Run: pnpm test:db

Expected: FAIL because lobby functions do not exist.

- [ ] **Step 2: Implement hardened transaction functions**

Every function must use SECURITY DEFINER, SET search_path = pg_catalog, private, fully qualified table references, and fixed argument types. Revoke execute from public and grant execute only to quickimposter_app.

~~~sql
create function private.create_online_room(p_room jsonb, p_player jsonb, p_session jsonb) returns jsonb;
create function private.join_online_room(p_room_id text, p_player jsonb, p_session jsonb) returns jsonb;
create function private.get_online_room_snapshot(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_known_version integer
) returns jsonb;
create function private.heartbeat_online_room(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text
) returns jsonb;
create function private.check_online_rate_limit(
  p_key_digest text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns boolean;
create function private.cleanup_online_room(p_room_id text) returns void;
~~~

Create and join lock the room row, run cleanup first, count every non-removed player, enforce 12 total, assign active only in lobby and waiting otherwise, and map constraint collisions to nickname-taken. Snapshot returns only RoomSnapshot fields, returns a changed-false object when p_known_version equals the current version, and never returns digests, unrevealed words, pair IDs, or imposter IDs. Heartbeat accepts only an unrevoked unexpired session digest.

- [ ] **Step 3: Write failing repository contract tests**

Mock a Pick<Pool, "query"> and assert parameterized SQL, stable argument order, result unwrapping, and PostgreSQL error preservation.

~~~ts
it("passes the known version to the snapshot function", async () => {
  const query = vi.fn().mockResolvedValue({
    rows: [{ result: { changed: false, version: 4 } }],
  });
  const repository = createRoomRepository({ query } as never);
  await repository.getSnapshot("room", "session", "a".repeat(64), 4);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("private.get_online_room_snapshot"),
    ["room", "session", "a".repeat(64), 4],
  );
});
~~~

- [ ] **Step 4: Implement a thin repository**

Use one SELECT private.function(...) AS result query per method. Do not add lifecycle rules, word selection, cookie access, or HTTP mapping. Validate that each call returns exactly one result row; otherwise throw a RepositoryError with code unavailable.

- [ ] **Step 5: Verify database, repository, and security**

Run:

~~~bash
pnpm db:migrate
pnpm test:db
pnpm exec vitest run src/online/room-repository.test.ts
pnpm test
pnpm lint
git diff --check
~~~

Expected: lobby concurrency and redaction tests pass; quickimposter_app still cannot select any table.

- [ ] **Step 6: Commit and push**

~~~bash
git add db/migrations/00002_online_room_lobby_functions.sql db/integration/online-room-lobby.test.ts src/online/room-repository.ts src/online/room-repository.test.ts
git commit -m "add Neon online lobby persistence"
git push origin agent/online-multiplayer-design
~~~

### Task 4: Implement Atomic Round Functions and the Room Service

**Files:**

- Create: db/migrations/00003_online_round_functions.sql
- Create: db/integration/online-rounds.test.ts
- Modify: src/online/room-repository.ts
- Modify: src/online/room-repository.test.ts
- Create: src/online/room-service.ts
- Create: src/online/room-service.test.ts

**Interfaces:**

- Produces database functions: private.get_online_player_secret, private.start_online_round, private.mark_online_player_ready, private.reveal_online_imposter, private.reveal_online_civilian, private.replay_online_room, private.cancel_online_round, private.close_online_room.
- Produces RoomService methods: create, join, snapshot, secret, command, heartbeat, checkRateLimit, cleanupStaleRooms.
- Consumes system WORD_PAIRS and selectWordPair; custom words never enter the online path.

- [ ] **Step 1: Write failing service tests one behavior at a time**

Start with opaque room creation and raw-token exclusion, then add join normalization, unchanged snapshot forwarding, personal secret, unused-pair preference, least-recent fallback when every category pair is recent, host capability requirements, error mapping, and heartbeat.

~~~ts
it("never sends raw capabilities to the repository", async () => {
  const repository = createRepositoryMock();
  repository.createRoom.mockResolvedValue(snapshotResult);
  const result = await createRoomService(repository).create({
    nickname: "Maya",
    category: "Food",
  });
  expect(result.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(JSON.stringify(repository.createRoom.mock.calls)).not.toContain(
    result.capability.parts.playerToken,
  );
  expect(repository.createRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      session: expect.objectContaining({
        playerTokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }),
  );
});
~~~

Run: pnpm exec vitest run src/online/room-service.test.ts

Expected: FAIL because room-service.ts is absent.

- [ ] **Step 2: Add failing round integration slices**

Test exact version conflicts, 3-player minimum, one immutable imposter assignment, all-ready automatic discussion transition, acting-player-only secret, host-only staged reveal, replay admitting waiting players, round cancellation, explicit closure, revoked sessions, and one version increment per successful command.

Run: pnpm test:db

Expected: FAIL because round functions do not exist.

- [ ] **Step 3: Implement the round transaction migration**

Each mutating function locks private.rooms FOR UPDATE, invokes cleanup, rejects closed/expired rooms, validates the expected version, validates the capability digests and required host permission, permits only the legal source phase, and increments rooms.version exactly once.

start_online_round receives a server-selected round ID and system word pair JSON, snapshots 3–12 active players ordered by join_order, chooses exactly one imposter with ORDER BY gen_random_uuid() LIMIT 1, inserts immutable round_players assignments, and enters private-reveal. ready advances to discussion only when no participant remains unready. Secret returns one word for the acting participant only. Reveal imposter and civilian are separate host operations. Replay returns to lobby and activates waiting players. Cancel discards the incomplete round. Close revokes every session and nulls unrevealed secrets before retaining the tombstone.

Grant only these function signatures to quickimposter_app and verify public has no execute privilege.

- [ ] **Step 4: Implement repository extensions and the coordinating service**

Repository additions remain one function call each: getRecentPairIds, getSecret, startRound, runCommand, cleanupStaleRooms.

The service must:

- generate 128-bit base64url room IDs and UUID player/round IDs;
- create 256-bit capabilities, hash raw tokens before repository calls, and return raw capabilities only for the cookie boundary;
- normalize nicknames with normalizeNickname;
- select only from WORD_PAIRS through selectWordPair using the 30 recent pair IDs;
- pass the client expectedVersion to every command;
- map invalid-request, not-found, room-full, nickname-taken, unauthorized, conflict, room-closed, rate-limited, and unavailable into RoomServiceError without returning database text.

Mark the module server-only and keep each public service method as workflow coordination rather than SQL construction.

- [ ] **Step 5: Verify atomicity, secrecy, and application behavior**

Run:

~~~bash
pnpm db:migrate
pnpm test:db
pnpm exec vitest run src/online/room-service.test.ts src/online/room-repository.test.ts
pnpm test
pnpm lint
pnpm exec tsc --noEmit
git diff --check
~~~

Expected: all round and service tests pass; no snapshot contains unrevealed words or assignments.

- [ ] **Step 6: Commit and push**

~~~bash
git add db/migrations/00003_online_round_functions.sql db/integration/online-rounds.test.ts src/online/room-repository.ts src/online/room-repository.test.ts src/online/room-service.ts src/online/room-service.test.ts
git commit -m "add Neon online round state machine"
git push origin agent/online-multiplayer-design
~~~

### Task 5: Expose Account-Free Route Handlers

**Files:**

- Create: src/app/api/online/rooms/route.ts
- Create: src/app/api/online/rooms/[roomId]/route.ts
- Create: src/app/api/online/rooms/[roomId]/join/route.ts
- Create: src/app/api/online/rooms/[roomId]/secret/route.ts
- Create: src/app/api/online/rooms/[roomId]/commands/route.ts
- Create: src/app/api/online/rooms/[roomId]/heartbeat/route.ts
- Create: src/app/api/online/rooms/routes.test.ts
- Create: src/online/request-rate-limit.ts
- Create: src/online/request-rate-limit.test.ts
- Modify: src/online/room-validation.ts
- Modify: src/online/room-validation.test.ts

**Interfaces:**

- Produces JSON API consumed by Tasks 6–8.
- Snapshot GET accepts ?version=<nonnegative integer>; unchanged state returns 204 and changed state returns RoomSnapshot JSON.
- Produces roomSnapshotSchema for validating snapshot JSON at both HTTP and browser boundaries.
- Consumes RoomService and room-cookie functions.

- [ ] **Step 1: Read the local Next.js guides**

Read completely:

- node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
- node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
- node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md

Record any Next.js 16.2 behavior that changes the examples below before writing handlers.

- [ ] **Step 2: Write failing handler tests**

Use native Request objects and mocked service/cookie boundaries. Add roomSnapshotSchema tests for every phase, nullable viewer/result fields, and rejection of missing or secret-bearing extra fields. Cover invalid JSON 400, invalid room ID 400, unauthorized 401, full 409, stale command 409, closed 410, unavailable 503, create/join Set-Cookie, changed snapshot no-store JSON, unchanged snapshot 204 with an empty body, and secret JSON containing only word.

Run: pnpm exec vitest run src/app/api/online/rooms/routes.test.ts

Expected: FAIL because route modules are absent.

- [ ] **Step 3: Implement HMAC rate identities and limits**

request-rate-limit.ts must hash inputs with ROOM_RATE_LIMIT_SECRET and never log addresses or session IDs.

~~~ts
export function requestKey(scope: string, identity: string) {
  const secret = process.env.ROOM_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("ROOM_RATE_LIMIT_SECRET is not configured");
  return createHmac("sha256", secret)
    .update(scope)
    .update("\0")
    .update(identity)
    .digest("hex");
}
~~~

Use IP identity for create 10/600s and join 30/600s. Use session identity for snapshot 420/300s, secret 60/300s, command 120/300s, and heartbeat 30/300s. Guests without a session use IP identity for snapshot 90/300s.

- [ ] **Step 4: Implement create, join, snapshot, secret, command, and heartbeat**

Await RouteContext params, validate every body/query with Zod, use async cookies, and set Cache-Control: no-store, max-age=0 on room responses. Define roomSnapshotSchema from the existing RoomSnapshot fields with strict nested objects so database-only fields are rejected. Write capability cookies only after successful create/join. Map RoomServiceError codes to stable status codes without returning database errors. Snapshot passes knownVersion to the service and returns new Response(null, { status: 204, headers: NO_STORE }) for changed false.

- [ ] **Step 5: Verify route types and build**

Run:

~~~bash
pnpm exec vitest run src/app/api/online/rooms/routes.test.ts src/online/request-rate-limit.test.ts
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
~~~

Expected: tests pass and Next.js accepts awaited route params without synchronous API warnings.

- [ ] **Step 6: Commit and push**

~~~bash
git add src/app/api/online/rooms src/online/request-rate-limit.ts src/online/request-rate-limit.test.ts src/online/room-validation.ts src/online/room-validation.test.ts
git commit -m "add Neon online room API"
git push origin agent/online-multiplayer-design
~~~

### Task 6: Add the Homepage Online Entry

**Files:**

- Create: src/components/game/game-mode-setup.tsx
- Create: src/components/game/online-setup.tsx
- Create: src/components/game/game-mode-setup.test.tsx
- Modify: src/components/game/game-experience.tsx
- Modify: src/components/game/setup-screen.tsx
- Modify: src/components/game/game-experience.test.tsx
- Modify: src/app/globals.css

**Interfaces:**

- Produces Local/Online controls and a create-room form.
- Consumes POST /api/online/rooms and navigates to /game/[roomId].

- [ ] **Step 1: Write failing UI tests**

Assert Local remains the default and starts the current six-player handoff unchanged. Switch to Online and assert player-count/custom-word controls disappear. Submit Maya plus Food, verify the exact request body, and verify router.push receives /game/<roomId>. Assert server errors render with role alert without clearing inputs.

Run: pnpm exec vitest run src/components/game/game-mode-setup.test.tsx src/components/game/game-experience.test.tsx

Expected: FAIL because Online mode is absent.

- [ ] **Step 2: Implement mode selection without changing the reducer**

GameModeSetup owns only local or online. It renders the existing SetupScreen for local and OnlineSetup for online. OnlineSetup owns nickname, category, pending, and safe error state; it posts JSON and navigates only after a successful response.

- [ ] **Step 3: Add accessible responsive styles**

Reuse the existing color variables, typography, panel widths, focus rings, 44px targets, and reduced-motion rules. Add game-mode-switch, online-setup-fields, online-error, and online-loading classes. Do not add gradients, glass, or a second visual system.

- [ ] **Step 4: Verify local regression and online entry**

Run:

~~~bash
pnpm exec vitest run src/components/game
pnpm test
pnpm lint
git diff --check
~~~

Expected: all existing local tests and the new online entry tests pass.

- [ ] **Step 5: Commit and push**

~~~bash
git add src/components/game/game-mode-setup.tsx src/components/game/online-setup.tsx src/components/game/game-mode-setup.test.tsx src/components/game/game-experience.tsx src/components/game/setup-screen.tsx src/components/game/game-experience.test.tsx src/app/globals.css
git commit -m "add online room entry"
git push origin agent/online-multiplayer-design
~~~

### Task 7: Build the Dynamic Room Route, Join Screen, and Lobby

**Files:**

- Create: src/app/game/[roomId]/layout.tsx
- Create: src/app/game/[roomId]/page.tsx
- Create: src/app/game/[roomId]/page.test.tsx
- Create: src/components/online/online-room-controller.tsx
- Create: src/components/online/join-room-screen.tsx
- Create: src/components/online/lobby-screen.tsx
- Create: src/components/online/lobby-screen.test.tsx
- Modify: src/app/globals.css

**Interfaces:**

- Produces a dynamic noindex room route, guest join, invitation copying, roster, and host start.
- Consumes snapshot, join, and command endpoints plus RoomSnapshot.

- [ ] **Step 1: Read dynamic-route and redirect guides**

Read completely:

- node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
- node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md
- node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_noStore.md when present, otherwise the current caching guide linked by route.md.

- [ ] **Step 2: Write failing route and lobby tests**

Cover awaited params, invalid/missing/closed redirect to /, noindex metadata, guest nickname form, clipboard.writeText(location.href), active/waiting/disconnected roster states, disabled Start below three active players, enabled Start at three, guest Waiting for host, the five-minute host-away countdown, and host-only controls.

- [ ] **Step 3: Implement the server route**

Validate roomId before database access. Read the room cookie asynchronously, fetch an initial snapshot without a known version, and redirect outside try/catch for not-found, closed, or expired rooms. Do not use generateStaticParams or cache the snapshot. Render OnlineRoomController with initialSnapshot and needsNickname.

- [ ] **Step 4: Implement join and lobby components**

JoinRoomScreen validates nickname locally, POSTs to join, and replaces controller state with the returned snapshot. LobbyScreen renders the opaque invitation URL, category, capacity, roster state, copy feedback, and host Start. No lobby prop includes a word, pair ID, token, or imposter ID.

- [ ] **Step 5: Style and verify the room shell**

Add online-room-shell, room-panel, invite-row, room-roster, player-state, host-badge, and responsive rules. Keep the primary action visible at 390 by 844.

Run:

~~~bash
pnpm exec vitest run src/app/game src/components/online/lobby-screen.test.tsx
pnpm test
pnpm lint
pnpm build
git diff --check
~~~

Expected: tests pass and the build reports a dynamic /game/[roomId] route.

- [ ] **Step 6: Commit and push**

~~~bash
git add src/app/game src/components/online/online-room-controller.tsx src/components/online/join-room-screen.tsx src/components/online/lobby-screen.tsx src/components/online/lobby-screen.test.tsx src/app/globals.css
git commit -m "add Neon online lobby experience"
git push origin agent/online-multiplayer-design
~~~

### Task 8: Add Adaptive Synchronization and Complete Round Screens

**Files:**

- Create: src/components/online/use-room-sync.ts
- Create: src/components/online/use-room-sync.test.tsx
- Create: src/components/online/online-secret-screen.tsx
- Create: src/components/online/online-secret-screen.test.tsx
- Create: src/components/online/online-discussion-screen.tsx
- Create: src/components/online/online-reveal-flow.tsx
- Create: src/components/online/online-reveal-flow.test.tsx
- Modify: src/components/online/online-room-controller.tsx
- Modify: src/components/game/secret-word-screen.tsx
- Modify: src/components/game/secret-word-screen.test.tsx
- Modify: src/app/globals.css

**Interfaces:**

- Produces useRoomSync({ roomId, version, onSnapshot, onClosed, onStatus }).
- Consumes snapshot, secret, command, and heartbeat endpoints.
- Produces complete private-reveal, discussion, staged reveal, result, replay, cancel, and close phases.

- [ ] **Step 1: Write failing synchronization tests**

Use fake timers and a deferred fetch mock. Assert immediate mount check, 1,000 ms visible cadence, 5,000 ms hidden cadence, no overlapping request, 204 no update, changed snapshot callback, immediate focus/online retry, bounded failure delays of 1s, 2s, 4s, 8s, and 15s, AbortController cleanup, closed callback on 404/410, and no timer after unmount.

~~~ts
it("switches from visible to hidden cadence", async () => {
  vi.useFakeTimers();
  renderHook(() => useRoomSync(props));
  await vi.advanceTimersByTimeAsync(1_000);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  setVisibility("hidden");
  await vi.advanceTimersByTimeAsync(4_999);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetchSnapshot).toHaveBeenCalledTimes(3);
});
~~~

- [ ] **Step 2: Extract reusable private-word presentation**

Move only the press-and-hold reveal mechanics into a focused private-word control. Preserve every current local prop and privacy behavior. OnlineSecretScreen fetches /secret once per private-reveal version, keeps the word in component memory only, hides on pointer release/blur/visibility change, and submits ready once.

- [ ] **Step 3: Implement serialized adaptive polling**

useRoomSync sends GET /api/online/rooms/<roomId>?version=<version> with cache no-store. It schedules the next request only after the current request settles, reads document.visibilityState for cadence, resets backoff after any successful response, and triggers immediate checks after focus and online events. It never treats a response body as valid until JSON parsing and RoomSnapshot shape validation succeed.

- [ ] **Step 4: Implement controller heartbeat and phase orchestration**

OnlineRoomController:

- owns the authoritative snapshot and safe connection status;
- starts one 15-second heartbeat only after viewerPlayerId exists;
- performs an immediate snapshot check after successful join or command;
- disables mutations while disconnected, stale, or pending;
- keeps the last safe screen visible with reconnect status during network failure and shows the authoritative host-away countdown from hostAwaySince;
- replaces navigation with / when the hook reports closed;
- chooses lobby, secret, discussion, imposter reveal, civilian reveal, or closed behavior from snapshot.phase;
- never optimistically reveals a word or identity.

OnlineDiscussionScreen provides external discussion instructions and the host reveal confirmation. OnlineRevealFlow shows imposter nickname/word first, civilian word second, then host Play again and End room.

- [ ] **Step 5: Verify privacy, timing, and convergence**

Run:

~~~bash
pnpm exec vitest run src/components/game/secret-word-screen.test.tsx src/components/online
pnpm test
pnpm lint
pnpm exec tsc --noEmit
git diff --check
~~~

Expected: all polling/privacy tests pass with no open timer, act, hook dependency, or accessibility warning.

- [ ] **Step 6: Commit and push**

~~~bash
git add src/components/game/secret-word-screen.tsx src/components/game/secret-word-screen.test.tsx src/components/online src/app/globals.css
git commit -m "add synchronized Neon online rounds"
git push origin agent/online-multiplayer-design
~~~

### Task 9: Enforce Retention Cleanup, SEO, and Analytics Isolation

**Files:**

- Create: db/migrations/00004_online_room_cleanup.sql
- Modify: db/integration/online-rounds.test.ts
- Create: src/app/api/online/cleanup/route.ts
- Create: src/app/api/online/cleanup/route.test.ts
- Create: vercel.json
- Create: src/components/marketing-scripts.tsx
- Modify: src/app/layout.tsx
- Modify: src/app/page.tsx
- Modify: src/app/page.test.tsx
- Modify: src/app/robots.ts
- Modify: src/app/seo.test.ts
- Modify: STRUCTURE.md

**Interfaces:**

- Produces private.cleanup_online_rooms(), a CRON_SECRET-protected cleanup route, daily best-effort retention cleanup, marketing-only scripts, and crawler boundaries.
- Request-triggered private.cleanup_online_room remains the correctness mechanism.

- [ ] **Step 1: Write failing cleanup and privacy tests**

Database tests cover five-minute host closure, six-hour expiry, disconnected non-host removal outside immutable rounds, session revocation, unrevealed secret clearing, expired rate-bucket deletion, and eventual tombstone deletion.

Application tests assert unauthorized cleanup returns 401, Bearer CRON_SECRET invokes cleanup, homepage retains analytics scripts, room modules do not import MarketingScripts, robots disallows /game/, sitemap remains homepage-only, and public copy no longer claims online rooms do not exist.

- [ ] **Step 2: Implement global retention cleanup**

00004_online_room_cleanup.sql defines private.cleanup_online_rooms() as a hardened SECURITY DEFINER function granted only to quickimposter_app. It finds stale or expired rooms in bounded batches with FOR UPDATE SKIP LOCKED, calls the same close logic used by request cleanup, deletes expired rate buckets, and deletes closed tombstones only after the documented retention interval. It must not be required for a room request to observe closure.

- [ ] **Step 3: Implement the optional Vercel backstop**

The cleanup Route Handler compares Authorization with Bearer plus CRON_SECRET using timing-safe comparison, returns 401 without details on mismatch, calls RoomService.cleanupStaleRooms on success, and returns no-store JSON containing only a numeric cleaned count.

Create vercel.json:

~~~json
{
  "crons": [
    {
      "path": "/api/online/cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
~~~

Daily cadence keeps this compatible with low-cost Vercel plans; room correctness continues to come from request-triggered cleanup.

- [ ] **Step 4: Isolate analytics and update crawler boundaries**

Move AdSense, Plausible, and Google Analytics from the root layout into MarketingScripts rendered only by the homepage. Preserve their existing IDs. Update FAQ copy to: No. Local play still works instantly with no account or room. Online rooms are optional when everyone wants to use their own device.

Add disallow /game/ to robots, retain the homepage sitemap only, and document /game/[roomId] as dynamic, private, noindex, and absent from sitemap in STRUCTURE.md.

- [ ] **Step 5: Verify retention and privacy**

Run:

~~~bash
pnpm db:migrate
pnpm test:db
pnpm exec vitest run src/app/api/online/cleanup/route.test.ts src/app/page.test.tsx src/app/seo.test.ts
pnpm test
pnpm lint
pnpm build
git diff --check
~~~

Expected: all checks pass; / stays static, /game/[roomId] stays dynamic, and room output contains no analytics/ad script ID.

- [ ] **Step 6: Commit and push**

~~~bash
git add db/migrations/00004_online_room_cleanup.sql db/integration/online-rounds.test.ts src/app/api/online/cleanup src/components/marketing-scripts.tsx src/app/layout.tsx src/app/page.tsx src/app/page.test.tsx src/app/robots.ts src/app/seo.test.ts STRUCTURE.md vercel.json
git commit -m "harden Neon online room lifecycle"
git push origin agent/online-multiplayer-design
~~~

### Task 10: Add Multi-Browser Acceptance and Neon Operations

**Files:**

- Create: playwright.config.ts
- Create: e2e/online-room.spec.ts
- Create: docs/online-mode-operations.md
- Modify: README.md

**Interfaces:**

- Produces a repeatable three-browser acceptance test and Neon/Vercel runbook.
- Consumes the isolated Neon test branch and complete room UI/API.

- [ ] **Step 1: Configure Playwright**

~~~ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
~~~

- [ ] **Step 2: Write the failing multi-context flow**

Use one host context and two guest contexts. Create a room, obtain its URL, join unique nicknames, wait for polling convergence, start, assert each browser sees one private word and no unrevealed role label, mark all ready, reveal in two stages, play again, join a late fourth player during an active round and assert waiting, close the room, and assert all existing contexts plus a fresh visit end at /.

Run: pnpm exec playwright test e2e/online-room.spec.ts

Expected before integration fixes: the test fails at the first real contract mismatch; fix the owning module rather than adding test-only behavior.

- [ ] **Step 3: Document exact Neon and Vercel operations**

docs/online-mode-operations.md must include:

- Neon project, main branch, isolated development/test branch, region selection near the Vercel function region, and branch cleanup;
- creation of a LOGIN runtime role with a generated password, GRANT quickimposter_app membership, pooled runtime URL, and direct owner migration URL;
- safe local and Vercel environment configuration without printing or committing credentials;
- pnpm db:migrate, checksum failure behavior, schema verification, and forward-only rollback migrations;
- ROOM_RATE_LIMIT_SECRET and CRON_SECRET generation with openssl rand -base64 32;
- Vercel Fluid Compute and daily Cron configuration;
- test:db, Vitest, Playwright, lint, typecheck, build, and closed-link verification;
- Neon query/log inspection without recording nicknames, room IDs, words, capabilities, or assignments;
- deployment rollback order: revert the application first, then use a forward migration or Neon restore branch for database recovery.

Update README with exact setup and verification commands.

- [ ] **Step 4: Provision the production runtime role safely**

On the Neon development branch first, generate a password without emitting it to logs, create quickimposter_runtime LOGIN, grant it quickimposter_app, build a pooled runtime connection string, store it in local/Vercel DATABASE_URL, and verify:

~~~sql
set role quickimposter_runtime;
select has_table_privilege(current_user, 'private.room_sessions', 'SELECT');
select has_function_privilege(current_user, 'private.get_online_room_snapshot(text,uuid,text,integer)', 'EXECUTE');
~~~

Expected: table privilege is false and approved function execute is true. Repeat on production only after the same migration and tests pass on the isolated branch.

- [ ] **Step 5: Run the complete verification gate**

Run:

~~~bash
pnpm db:migrate
pnpm test:db
pnpm test
pnpm exec playwright test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
~~~

Expected: every command exits 0; all pre-existing local tests remain green; Playwright passes the multi-browser flow; build reports / static and /game/[roomId] dynamic.

- [ ] **Step 6: Commit, push, and open a draft PR**

~~~bash
git add playwright.config.ts e2e/online-room.spec.ts docs/online-mode-operations.md README.md
git commit -m "verify Neon online multiplayer rooms"
git push origin agent/online-multiplayer-design
~~~

Open a draft PR from agent/online-multiplayer-design to main. Include links to the design and this plan, the Neon role/migration model, polling cadence, security boundaries, checks run, and required Vercel environment variables. Never paste connection strings or secrets into the PR.
