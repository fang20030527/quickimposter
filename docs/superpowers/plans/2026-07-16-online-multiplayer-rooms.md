# Online Multiplayer Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account-free Supabase-backed online rooms where 3–12 players join by link, receive one private word each, synchronize the round, and return to the homepage after the room closes.

**Architecture:** Keep the current local reducer untouched. Next.js 16 Route Handlers own cookies, validation, and all authoritative commands; Supabase Postgres stores state in a non-exposed `private` schema, while service-role-only security-invoker RPC functions make transitions atomic. Supabase Realtime public Broadcast topics carry only `{ version }` invalidations, and clients refetch sanitized snapshots from Next.js.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5.9, Zod 4.4.3, Supabase JS 2.110.7, Supabase Postgres/Realtime/Cron, Vitest 4.1, Testing Library 16.3, Playwright 1.61.1, pnpm 10.

## Global Constraints

- Preserve the existing local-device mode and all 18 baseline tests.
- Online rooms have no login, profiles, custom words, chat, voice, voting, scores, or host transfer.
- The host is a player; 3–12 non-removed room members are allowed in total.
- Late arrivals wait for the next lobby and never alter an active round snapshot.
- Only system word pairs are available online; exclude the room's 30 most recent pair IDs when alternatives exist.
- Room IDs use at least 128 random bits; player and host capabilities use at least 256 random bits.
- Session cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, and written only by Route Handlers using async `cookies()`.
- Unrevealed words, roles, raw tokens, nicknames, and room IDs never enter analytics, advertising payloads, or logs.
- Host absence closes the room after five minutes; every room has a six-hour hard expiry.
- Missing, closed, and expired `/game/[roomId]` requests redirect to `/`; online routes are noindex and absent from the sitemap.
- Do not cache room snapshots, secrets, or commands. Dynamic `params` are promises in Next.js 16 and must be awaited.
- Keep Supabase secrets in server-only modules; only the project URL and publishable key may use `NEXT_PUBLIC_`.
- Core tables are not exposed to the Data API. Explicitly revoke `anon` and `authenticated`; enable RLS as defense in depth.
- Realtime Broadcast payloads contain only the authoritative room version.
- Pin new packages and commit `pnpm-lock.yaml`.
- Before database work on this Mac, update Xcode Command Line Tools to 26.3, then run `brew install supabase/tap/supabase`; the npm CLI package is verified broken on `darwin-arm64` in this environment.
- Baseline on 2026-07-16: `pnpm test`, `pnpm lint`, and `pnpm build` all pass.

## File Map

**Domain and server boundary**

- `src/online/room-types.ts`: serializable room, player, command, and API result types.
- `src/online/room-validation.ts`: Zod schemas and nickname normalization.
- `src/online/room-session.ts`: pure capability generation, encoding, parsing, and hashing.
- `src/online/room-cookies.ts`: Next.js cookie reads/writes.
- `src/online/supabase-admin.ts`: server-only service-role client.
- `src/online/supabase-browser.ts`: browser Realtime client using publishable credentials.
- `src/online/room-repository.ts`: typed RPC adapter only.
- `src/online/room-service.ts`: workflow coordination, word selection, redaction, and error mapping.
- `src/online/request-rate-limit.ts`: HMAC request identity and persisted action limits.

**Database**

- `supabase/config.toml`: local Supabase configuration.
- `supabase/migrations/20260716000100_online_room_schema.sql`: private tables, constraints, indexes, grants, and RLS.
- `supabase/migrations/20260716000200_online_room_lobby_rpc.sql`: create, join, snapshot, heartbeat, and rate-limit RPCs.
- `supabase/migrations/20260716000300_online_round_rpc.sql`: start, ready, reveal, replay, cancel, close, and cleanup RPCs.
- `supabase/tests/online_rooms.test.sql`: pgTAP permission, constraint, and transition tests.

**HTTP and UI**

- `src/app/api/online/rooms/route.ts`: create room.
- `src/app/api/online/rooms/[roomId]/route.ts`: get snapshot.
- `src/app/api/online/rooms/[roomId]/join/route.ts`: join room.
- `src/app/api/online/rooms/[roomId]/secret/route.ts`: get the acting player's word.
- `src/app/api/online/rooms/[roomId]/commands/route.ts`: host/player commands.
- `src/app/api/online/rooms/[roomId]/heartbeat/route.ts`: persisted presence heartbeat.
- `src/app/game/[roomId]/layout.tsx`: noindex metadata and ad-free route boundary.
- `src/app/game/[roomId]/page.tsx`: validate dynamic params and redirect closed rooms.
- `src/components/game/game-mode-setup.tsx`: Local/Online selection.
- `src/components/game/online-setup.tsx`: create-room form.
- `src/components/online/online-room-controller.tsx`: snapshot/reconnect state and phase routing.
- `src/components/online/join-room-screen.tsx`: nickname join form.
- `src/components/online/lobby-screen.tsx`: invitation and roster.
- `src/components/online/online-secret-screen.tsx`: personal word and Ready.
- `src/components/online/online-discussion-screen.tsx`: shared discussion and host reveal entry.
- `src/components/online/online-reveal-flow.tsx`: staged result and replay/close controls.
- `src/components/online/use-room-realtime.ts`: Broadcast subscription with polling fallback.
- `src/components/marketing-scripts.tsx`: marketing-only analytics and advertising scripts.

**Tests and deployment**

- Co-located `*.test.ts(x)` files for every domain/service/component module.
- `playwright.config.ts` and `e2e/online-room.spec.ts`: true multi-context browser flow.
- `.env.example`: exact required environment variable names.
- `docs/online-mode-operations.md`: Supabase/Vercel setup, migration, cron, rollback, and verification.

---

### Task 1: Pin Dependencies and Define the Online Domain

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `src/online/room-types.ts`
- Create: `src/online/room-validation.ts`
- Test: `src/online/room-validation.test.ts`

**Interfaces:**
- Produces: `RoomPhase`, `PlayerState`, `RoomSnapshot`, `RoomCommand`, `ApiErrorCode`, `normalizeNickname()`, `nicknameSchema`, `createRoomSchema`, `joinRoomSchema`, and `commandSchema`.
- Consumes: existing `Category` and `WordPair` types from `src/game/game-reducer.ts`.

- [ ] **Step 1: Add the failing validation tests**

```ts
import { describe, expect, it } from "vitest";
import { commandSchema, nicknameSchema, normalizeNickname } from "./room-validation";

describe("online room validation", () => {
  it("trims and normalizes a valid nickname", () => {
    expect(nicknameSchema.parse("  Maya  ")).toBe("Maya");
    expect(normalizeNickname("MÁYA")).toBe("máya");
  });

  it.each(["", "a", " ".repeat(4), "x".repeat(21)])("rejects nickname %j", (value) => {
    expect(() => nicknameSchema.parse(value)).toThrow();
  });

  it("accepts only declared room commands", () => {
    expect(commandSchema.parse({ type: "ready", expectedVersion: 3 })).toEqual({
      type: "ready",
      expectedVersion: 3,
    });
    expect(() => commandSchema.parse({ type: "skip-reveal", expectedVersion: 3 })).toThrow();
  });
});
```

- [ ] **Step 2: Verify the new test fails because the module is absent**

Run: `pnpm test -- src/online/room-validation.test.ts`

Expected: FAIL with `Failed to resolve import "./room-validation"`.

- [ ] **Step 3: Install pinned packages and expose the example env file**

Run:

```bash
pnpm add @supabase/supabase-js@2.110.7 server-only@0.0.1 zod@4.4.3
pnpm add -D @playwright/test@1.61.1
```

Append this exception after `.env*` in `.gitignore`:

```gitignore
!.env.example
```

Create `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_me
ROOM_RATE_LIMIT_SECRET=replace_with_32_random_bytes
```

- [ ] **Step 4: Implement the exact shared types and schemas**

```ts
// src/online/room-types.ts
import type { Category } from "@/game/game-reducer";

export type RoomPhase =
  | "lobby"
  | "private-reveal"
  | "discussion"
  | "imposter-revealed"
  | "civilian-revealed"
  | "closed";
export type PlayerState = "active" | "waiting" | "disconnected" | "removed";
export type PlayerSummary = {
  id: string;
  nickname: string;
  state: PlayerState;
  isHost: boolean;
  isReady: boolean;
};
export type RoomSnapshot = {
  roomId: string;
  phase: RoomPhase;
  version: number;
  category: Category;
  viewerPlayerId: string | null;
  viewerIsHost: boolean;
  players: PlayerSummary[];
  readyCount: number;
  participantCount: number;
  hostAwaySince: string | null;
  expiresAt: string;
  result: null | {
    imposterNickname: string;
    imposterWord: string;
    civilianWord: string | null;
  };
};
export type RoomCommand =
  | { type: "start"; expectedVersion: number }
  | { type: "ready"; expectedVersion: number }
  | { type: "reveal-imposter"; expectedVersion: number }
  | { type: "reveal-civilian"; expectedVersion: number }
  | { type: "play-again"; expectedVersion: number }
  | { type: "cancel-round"; expectedVersion: number }
  | { type: "close-room"; expectedVersion: number };
export type ApiErrorCode =
  | "invalid-request" | "not-found" | "room-full" | "nickname-taken"
  | "unauthorized" | "conflict" | "room-closed" | "rate-limited" | "unavailable";
```

```ts
// src/online/room-validation.ts
import { z } from "zod";
import { PLAYER_COUNTS, type Category } from "@/game/game-reducer";

const categories = ["All Categories", "Food", "Animals", "Objects", "Places", "Entertainment", "Sports", "Jobs", "Nature"] as const satisfies readonly Category[];
export const nicknameSchema = z.string().trim().min(2).max(20).refine((value) => [...value].every((char) => !/\p{C}/u.test(char)), "Use visible characters only");
export const normalizeNickname = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
export const roomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const createRoomSchema = z.object({ nickname: nicknameSchema, category: z.enum(categories) });
export const joinRoomSchema = z.object({ nickname: nicknameSchema });
const expectedVersion = z.number().int().nonnegative();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), expectedVersion }),
  z.object({ type: z.literal("ready"), expectedVersion }),
  z.object({ type: z.literal("reveal-imposter"), expectedVersion }),
  z.object({ type: z.literal("reveal-civilian"), expectedVersion }),
  z.object({ type: z.literal("play-again"), expectedVersion }),
  z.object({ type: z.literal("cancel-round"), expectedVersion }),
  z.object({ type: z.literal("close-room"), expectedVersion }),
]);
export const MIN_PLAYERS = PLAYER_COUNTS[0];
export const MAX_PLAYERS = PLAYER_COUNTS.at(-1)!;
```

- [ ] **Step 5: Run the focused and full unit suites**

Run: `pnpm test -- src/online/room-validation.test.ts && pnpm test`

Expected: focused test PASS; full suite reports 7 files and 21 tests passing.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore .env.example src/online/room-types.ts src/online/room-validation.ts src/online/room-validation.test.ts
git commit -m "add online room domain"
```

### Task 2: Create the Private Database Schema

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20260716000100_online_room_schema.sql`
- Create: `supabase/tests/online_rooms.test.sql`

**Interfaces:**
- Produces: `private.rooms`, `private.players`, `private.room_sessions`, `private.rounds`, `private.round_players`, and `private.rate_limits`.
- Consumes: Supabase Postgres, `pgcrypto`, and Realtime schemas supplied by Supabase.

- [ ] **Step 1: Restore the supported CLI and initialize Supabase**

Run after updating Xcode Command Line Tools to 26.3:

```bash
brew install supabase/tap/supabase
supabase --version
supabase init
supabase migration new online_room_schema
generated=$(find supabase/migrations -name '*_online_room_schema.sql' -print -quit)
mv "$generated" supabase/migrations/20260716000100_online_room_schema.sql
```

Expected: `supabase --version` is `2.109.1` or newer and the exact planned migration path exists.

- [ ] **Step 2: Write the failing pgTAP structure test**

```sql
begin;
select plan(8);
select has_schema('private');
select has_table('private', 'rooms');
select has_table('private', 'players');
select has_table('private', 'room_sessions');
select has_table('private', 'rounds');
select has_table('private', 'round_players');
select has_table('private', 'rate_limits');
select table_privs_are('private', 'rooms', 'anon', array[]::text[]);
select * from finish();
rollback;
```

Run: `supabase start && supabase test db supabase/tests/online_rooms.test.sql`

Expected: FAIL because the `private` schema does not exist.

- [ ] **Step 3: Implement the schema migration**

```sql
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create type private.room_phase as enum ('lobby','private-reveal','discussion','imposter-revealed','civilian-revealed','closed');
create type private.player_state as enum ('active','waiting','disconnected','removed');
create type private.assignment_role as enum ('civilian','imposter');

create table private.rooms (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  phase private.room_phase not null default 'lobby',
  version bigint not null default 0 check (version >= 0),
  category text not null,
  host_player_id uuid,
  current_round_id uuid,
  host_last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  expires_at timestamptz not null
);
create table private.players (
  id uuid primary key,
  room_id text not null references private.rooms(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  normalized_nickname text not null,
  state private.player_state not null default 'active',
  join_order integer not null check (join_order > 0),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table private.rooms add constraint rooms_host_player_fk foreign key (host_player_id) references private.players(id);
create unique index players_active_name_idx on private.players(room_id, normalized_nickname) where state <> 'removed';
create unique index players_join_order_idx on private.players(room_id, join_order) where state <> 'removed';

create table private.room_sessions (
  id uuid primary key,
  room_id text not null references private.rooms(id) on delete cascade,
  player_id uuid not null references private.players(id) on delete cascade,
  player_token_digest text not null,
  host_token_digest text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table private.rounds (
  id uuid primary key,
  room_id text not null references private.rooms(id) on delete cascade,
  phase private.room_phase not null default 'private-reveal',
  pair_id text not null,
  category text not null,
  civilian_word text not null,
  imposter_word text not null,
  imposter_player_id uuid not null references private.players(id),
  started_at timestamptz not null default now(),
  imposter_revealed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
alter table private.rooms add constraint rooms_current_round_fk foreign key (current_round_id) references private.rounds(id);
create table private.round_players (
  round_id uuid not null references private.rounds(id) on delete cascade,
  player_id uuid not null references private.players(id),
  participation_order integer not null,
  assignment private.assignment_role not null,
  ready_at timestamptz,
  primary key (round_id, player_id),
  unique (round_id, participation_order)
);
create table private.rate_limits (
  key_digest text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (key_digest, action, window_started_at)
);
create index rounds_recent_pairs_idx on private.rounds(room_id, started_at desc);
create index players_presence_idx on private.players(room_id, last_seen_at) where state <> 'removed';

alter table private.rooms enable row level security;
alter table private.players enable row level security;
alter table private.room_sessions enable row level security;
alter table private.rounds enable row level security;
alter table private.round_players enable row level security;
alter table private.rate_limits enable row level security;
grant select, insert, update, delete on all tables in schema private to service_role;
alter default privileges in schema private grant select, insert, update, delete on tables to service_role;
```

- [ ] **Step 4: Reset locally and verify schema/security**

Run: `supabase db reset && supabase test db supabase/tests/online_rooms.test.sql`

Expected: all 8 pgTAP assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/migrations/20260716000100_online_room_schema.sql supabase/tests/online_rooms.test.sql
git commit -m "add online room schema"
```

### Task 3: Add Capability Sessions and Supabase Clients

**Files:**
- Create: `src/online/room-session.ts`
- Create: `src/online/room-session.test.ts`
- Create: `src/online/room-cookies.ts`
- Create: `src/online/supabase-admin.ts`
- Create: `src/online/supabase-browser.ts`

**Interfaces:**
- Produces: `createRoomCapability()`, `parseRoomCapability()`, `digestToken()`, `readRoomCapability()`, `writeRoomCapability()`, `createAdminClient()`, and `createRealtimeClient()`.
- Consumes: environment names from Task 1.

- [ ] **Step 1: Write failing pure session tests**

```ts
import { describe, expect, it } from "vitest";
import { createRoomCapability, digestToken, parseRoomCapability } from "./room-session";

describe("room capability", () => {
  it("round-trips a player and host capability", async () => {
    const capability = createRoomCapability(true);
    expect(parseRoomCapability(capability.value)).toEqual(capability.parts);
    expect(await digestToken(capability.parts.playerToken)).toMatch(/^[a-f0-9]{64}$/);
    expect(capability.parts.hostToken).toHaveLength(43);
  });

  it("rejects malformed cookie values", () => {
    expect(parseRoomCapability("not-a-capability")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- src/online/room-session.test.ts`

Expected: FAIL because `room-session.ts` is absent.

- [ ] **Step 3: Implement pure capability functions**

```ts
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type CapabilityParts = { sessionId: string; playerToken: string; hostToken: string | null };
const token = () => randomBytes(32).toString("base64url");
export function createRoomCapability(isHost: boolean) {
  const parts: CapabilityParts = { sessionId: randomUUID(), playerToken: token(), hostToken: isHost ? token() : null };
  return { parts, value: [parts.sessionId, parts.playerToken, parts.hostToken ?? ""].join(".") };
}
export function parseRoomCapability(value: string): CapabilityParts | null {
  const [sessionId, playerToken, hostToken, extra] = value.split(".");
  if (extra !== undefined || !/^[0-9a-f-]{36}$/.test(sessionId ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(playerToken ?? "")) return null;
  if (hostToken && !/^[A-Za-z0-9_-]{43}$/.test(hostToken)) return null;
  return { sessionId, playerToken, hostToken: hostToken || null };
}
export async function digestToken(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function equalDigest(left: string, right: string) {
  const a = Buffer.from(left, "hex"); const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Add Next.js cookie and client boundaries**

```ts
// src/online/room-cookies.ts
import "server-only";
import { cookies } from "next/headers";
import { parseRoomCapability } from "./room-session";
const name = (roomId: string) => `qi-room-${roomId}`;
export async function readRoomCapability(roomId: string) {
  return parseRoomCapability((await cookies()).get(name(roomId))?.value ?? "");
}
export async function writeRoomCapability(roomId: string, value: string) {
  (await cookies()).set(name(roomId), value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 6 * 60 * 60 });
}
export async function clearRoomCapability(roomId: string) { (await cookies()).delete(name(roomId)); }
```

```ts
// src/online/supabase-admin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```

```ts
// src/online/supabase-browser.ts
import { createClient } from "@supabase/supabase-js";
export function createRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public environment is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```

- [ ] **Step 5: Run tests and build**

Run: `pnpm test -- src/online/room-session.test.ts && pnpm build`

Expected: session tests PASS; build PASS without requiring env values because clients are created lazily.

- [ ] **Step 6: Commit**

```bash
git add src/online/room-session.ts src/online/room-session.test.ts src/online/room-cookies.ts src/online/supabase-admin.ts src/online/supabase-browser.ts
git commit -m "add online room capabilities"
```

### Task 4: Implement Atomic Lobby RPCs and Repository Adapter

**Files:**
- Create: `supabase/migrations/20260716000200_online_room_lobby_rpc.sql`
- Modify: `supabase/tests/online_rooms.test.sql`
- Create: `src/online/room-repository.ts`
- Test: `src/online/room-repository.test.ts`

**Interfaces:**
- Produces RPCs: `create_online_room`, `join_online_room`, `get_online_room_snapshot`, `heartbeat_online_room`, `check_online_rate_limit`.
- Produces TS methods with the same camelCase names returning `{ data, error }` mapped into typed domain values.

- [ ] **Step 1: Generate the exact migration and add failing pgTAP cases**

Run:

```bash
supabase migration new online_room_lobby_rpc
generated=$(find supabase/migrations -name '*_online_room_lobby_rpc.sql' -print -quit)
mv "$generated" supabase/migrations/20260716000200_online_room_lobby_rpc.sql
```

Append concrete pgTAP assertions for RPC privileges and lobby errors:

```sql
select is(has_function_privilege('anon', 'public.create_online_room(jsonb,jsonb,jsonb)', 'EXECUTE'), false, 'anon cannot create rooms');
select is(has_function_privilege('service_role', 'public.create_online_room(jsonb,jsonb,jsonb)', 'EXECUTE'), true, 'service role can create rooms');
select throws_ok(
  $$select public.join_online_room('AAAAAAAAAAAAAAAAAAAAAA', jsonb_build_object('id', gen_random_uuid(), 'nickname', 'Maya', 'normalizedNickname', 'maya'), jsonb_build_object('id', gen_random_uuid(), 'playerTokenDigest', repeat('a', 64)))$$,
  'P0001', 'nickname-taken', 'normalized duplicate nicknames are rejected'
);
```

Seed 12 non-removed players under the same room and add a second `throws_ok` expecting SQLSTATE `P0001` and message `room-full` from the 13th `join_online_room` call.

Run: `supabase db reset && supabase test db supabase/tests/online_rooms.test.sql`

Expected: FAIL because the RPCs do not exist.

- [ ] **Step 2: Implement lobby RPC rules in one transaction per call**

Each public function must use `security invoker`, fully qualify `private.*`, revoke execute from `public, anon, authenticated`, grant execute to `service_role`, lock the room row with `for update`, and return JSON. Use this exact signature set:

```sql
create function public.create_online_room(p_room jsonb, p_player jsonb, p_session jsonb) returns jsonb language plpgsql security invoker;
create function public.join_online_room(p_room_id text, p_player jsonb, p_session jsonb) returns jsonb language plpgsql security invoker;
create function public.get_online_room_snapshot(p_room_id text, p_session_id uuid, p_player_digest text) returns jsonb language plpgsql security invoker stable;
create function public.heartbeat_online_room(p_room_id text, p_session_id uuid, p_player_digest text) returns jsonb language plpgsql security invoker;
create function public.check_online_rate_limit(p_key_digest text, p_action text, p_limit integer, p_window_seconds integer) returns boolean language plpgsql security invoker;
```

Within create/join: reject closed/expired rooms, count all non-removed players under the room lock, assign `active` in lobby and `waiting` otherwise, enforce 12 total, and call:

```sql
perform realtime.send(jsonb_build_object('version', v_version), 'room_changed', 'room:' || p_room_id, false);
```

Snapshot JSON must contain only the fields in `RoomSnapshot`; include result words only when phase permits and never include session digests, unrevealed pair values, or imposter IDs.

- [ ] **Step 3: Verify database behavior and run advisors**

Run:

```bash
supabase db reset
supabase test db supabase/tests/online_rooms.test.sql
supabase db advisors --local
```

Expected: pgTAP PASS; advisors report no RLS or exposed-function warnings.

- [ ] **Step 4: Write failing adapter tests with a mocked Supabase client**

```ts
it("calls the create RPC with exact payload keys", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { room_id: "room" }, error: null });
  const repository = createRoomRepository({ rpc } as never);
  await repository.createRoom({ room: { id: "room" }, player: { id: "p" }, session: { id: "s" } });
  expect(rpc).toHaveBeenCalledWith("create_online_room", { p_room: { id: "room" }, p_player: { id: "p" }, p_session: { id: "s" } });
});
```

- [ ] **Step 5: Implement a thin adapter without business rules**

```ts
export function createRoomRepository(client = createAdminClient()) {
  return {
    createRoom: (input: { room: unknown; player: unknown; session: unknown }) => client.rpc("create_online_room", { p_room: input.room, p_player: input.player, p_session: input.session }),
    joinRoom: (roomId: string, player: unknown, session: unknown) => client.rpc("join_online_room", { p_room_id: roomId, p_player: player, p_session: session }),
    getSnapshot: (roomId: string, sessionId: string | null, playerDigest: string | null) => client.rpc("get_online_room_snapshot", { p_room_id: roomId, p_session_id: sessionId, p_player_digest: playerDigest }),
    heartbeat: (roomId: string, sessionId: string, playerDigest: string) => client.rpc("heartbeat_online_room", { p_room_id: roomId, p_session_id: sessionId, p_player_digest: playerDigest }),
  };
}
```

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test -- src/online/room-repository.test.ts && pnpm test`

```bash
git add supabase/migrations/20260716000200_online_room_lobby_rpc.sql supabase/tests/online_rooms.test.sql src/online/room-repository.ts src/online/room-repository.test.ts
git commit -m "add online lobby persistence"
```

### Task 5: Implement Round Commands and the Room Service

**Files:**
- Create: `supabase/migrations/20260716000300_online_round_rpc.sql`
- Modify: `supabase/tests/online_rooms.test.sql`
- Modify: `src/online/room-repository.ts`
- Modify: `src/online/room-repository.test.ts`
- Create: `src/online/room-service.ts`
- Test: `src/online/room-service.test.ts`

**Interfaces:**
- Produces RPCs: `start_online_round`, `mark_online_player_ready`, `reveal_online_imposter`, `reveal_online_civilian`, `replay_online_room`, `cancel_online_round`, `close_online_room`, `get_online_player_secret`, `cleanup_online_rooms`.
- Produces: `createRoom()`, `joinRoom()`, `getSnapshot()`, `getSecret()`, `runCommand()`, `heartbeat()`.

- [ ] **Step 1: Add failing service tests**

Create a typed `createRepositoryMock()` and start with these assertions; add sibling tests for non-recent pair selection, ready auto-advance, `conflict`, and `room-closed` error mapping:

```ts
it("creates an opaque room without persisting raw capabilities", async () => {
  const repository = createRepositoryMock();
  repository.createRoom.mockResolvedValue({ data: snapshot, error: null });
  const result = await createRoomService(repository).create({ nickname: "Maya", category: "Food" });
  expect(result.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(repository.createRoom).toHaveBeenCalledWith(expect.objectContaining({
    session: expect.objectContaining({ playerTokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }),
  }));
  expect(JSON.stringify(repository.createRoom.mock.calls)).not.toContain(result.capability.parts.playerToken);
});

it("returns only the acting player's word", async () => {
  const repository = createRepositoryMock();
  repository.getSecret.mockResolvedValue({ data: { word: "Apple" }, error: null });
  await expect(createRoomService(repository).secret(roomId, capability.parts)).resolves.toEqual({ word: "Apple" });
});
```

Run: `pnpm test -- src/online/room-service.test.ts`

Expected: FAIL because `room-service.ts` is absent.

- [ ] **Step 2: Generate and implement the round migration**

Run `supabase migration new online_round_rpc`, rename it to `supabase/migrations/20260716000300_online_round_rpc.sql`, and implement the exact function set above with these invariants:

```sql
-- Every mutating RPC starts with a locked authoritative room row.
select * into v_room from private.rooms where id = p_room_id for update;
if v_room.version <> p_expected_version then raise exception using errcode = '40001', message = 'conflict'; end if;
if v_room.phase = 'closed' or v_room.expires_at <= now() then raise exception using errcode = 'P0001', message = 'room-closed'; end if;
```

`start_online_round` must verify host capability, 3–12 eligible active players, snapshot them, select exactly one imposter with `order by extensions.gen_random_bytes(16) limit 1`, insert assignments, set `private-reveal`, increment once, and Broadcast the new version. `mark_online_player_ready` updates only the acting participant and advances to `discussion` only when no current participant has `ready_at is null`. Reveal/replay/cancel/close must require host capability and legal phases. Cleanup marks a non-host disconnected after 45 seconds without a heartbeat, removes that player after five minutes when no round needs the immutable snapshot, closes rooms with `host_last_seen_at <= now() - interval '5 minutes'` or `expires_at <= now()`, revokes sessions, clears unrevealed words, and deletes expired rate buckets.

- [ ] **Step 3: Implement the coordinating service**

First extend `room-repository.ts` with one-RPC methods `getRecentPairIds`, `getCategory`, `startRound`, `getSecret`, and `runCommand`. Then implement the service with this exact control flow:

```ts
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { WORD_PAIRS } from "@/game/word-pairs";
import { selectWordPair } from "@/game/word-repository";

const newRoomId = () => randomBytes(16).toString("base64url");
export type RoomService = ReturnType<typeof createRoomService>;
export function createRoomService(repository = createRoomRepository()) {
  return {
    async create(input: z.infer<typeof createRoomSchema>) {
      const roomId = newRoomId(); const capability = createRoomCapability(true);
      const snapshot = unwrap(await repository.createRoom({
        room: { id: roomId, category: input.category, expiresAt: new Date(Date.now() + 21_600_000).toISOString() },
        player: { id: randomUUID(), nickname: input.nickname, normalizedNickname: normalizeNickname(input.nickname) },
        session: { id: capability.parts.sessionId, playerTokenDigest: await digestToken(capability.parts.playerToken), hostTokenDigest: await digestToken(capability.parts.hostToken!) },
      }));
      return { roomId, snapshot, capability };
    },
    async join(roomId: string, input: z.infer<typeof joinRoomSchema>) {
      const capability = createRoomCapability(false);
      const snapshot = unwrap(await repository.joinRoom(roomId, { id: randomUUID(), nickname: input.nickname, normalizedNickname: normalizeNickname(input.nickname) }, { id: capability.parts.sessionId, playerTokenDigest: await digestToken(capability.parts.playerToken) }));
      return { roomId, snapshot, capability };
    },
    async snapshot(roomId: string, capability: CapabilityParts | null) {
      return unwrap(await repository.getSnapshot(roomId, capability?.sessionId ?? null, capability ? await digestToken(capability.playerToken) : null));
    },
    async secret(roomId: string, capability: CapabilityParts) {
      return unwrap(await repository.getSecret(roomId, capability.sessionId, await digestToken(capability.playerToken)));
    },
    async command(roomId: string, capability: CapabilityParts, command: RoomCommand) {
      const auth = { sessionId: capability.sessionId, playerDigest: await digestToken(capability.playerToken), hostDigest: capability.hostToken ? await digestToken(capability.hostToken) : null };
      if (command.type !== "start") return unwrap(await repository.runCommand(roomId, auth, command));
      const recent = unwrap(await repository.getRecentPairIds(roomId));
      const category = unwrap(await repository.getCategory(roomId));
      const pair = selectWordPair(WORD_PAIRS, category, recent);
      return unwrap(await repository.startRound(roomId, auth, command.expectedVersion, { roundId: randomUUID(), pair }));
    },
    async heartbeat(roomId: string, capability: CapabilityParts) {
      return unwrap(await repository.heartbeat(roomId, capability.sessionId, await digestToken(capability.playerToken)));
    },
  };
}
```

Define `unwrap()` and `mapRepositoryError()` above the factory. `mapRepositoryError()` must exhaustively map database messages `invalid-request`, `not-found`, `room-full`, `nickname-taken`, `unauthorized`, `conflict`, `room-closed`, and `rate-limited` to a typed `RoomServiceError`; all other messages become `unavailable`.

Do not import this module into Client Components; mark it `server-only`. Reuse `selectWordPair()` and `WORD_PAIRS` only on the server for online rounds.

- [ ] **Step 4: Verify database, service, and security**

Run:

```bash
supabase db reset
supabase test db supabase/tests/online_rooms.test.sql
supabase db advisors --local
pnpm test -- src/online/room-service.test.ts
```

Expected: all pgTAP and service tests PASS; no security advisor findings.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716000300_online_round_rpc.sql supabase/tests/online_rooms.test.sql src/online/room-repository.ts src/online/room-repository.test.ts src/online/room-service.ts src/online/room-service.test.ts
git commit -m "add online round state machine"
```

### Task 6: Expose Account-Free Route Handlers

**Files:**
- Create: `src/app/api/online/rooms/route.ts`
- Create: `src/app/api/online/rooms/[roomId]/route.ts`
- Create: `src/app/api/online/rooms/[roomId]/join/route.ts`
- Create: `src/app/api/online/rooms/[roomId]/secret/route.ts`
- Create: `src/app/api/online/rooms/[roomId]/commands/route.ts`
- Create: `src/app/api/online/rooms/[roomId]/heartbeat/route.ts`
- Create: `src/app/api/online/rooms/routes.test.ts`
- Create: `src/online/request-rate-limit.ts`
- Test: `src/online/request-rate-limit.test.ts`

**Interfaces:**
- Produces JSON HTTP API consumed by Tasks 7–9.
- Consumes the service and cookie functions from Tasks 3 and 5.

- [ ] **Step 1: Write failing handler tests**

Test native `Request` objects directly: invalid JSON → 400, invalid room ID → 400, full → 409, stale command → 409, closed snapshot → 410, create/join responses include `Set-Cookie`, snapshot has `Cache-Control: no-store`, and secret JSON has only `{ word }`.

Run: `pnpm test -- src/app/api/online/rooms/routes.test.ts`

Expected: FAIL because route modules are absent.

- [ ] **Step 2: Implement create and join handlers**

Use `export async function POST(request: Request)` and `RouteContext<'/api/online/rooms/[roomId]/join'>`; await `ctx.params`, validate with Zod, call the service, write the cookie before returning, and return stable `{ roomId, snapshot }` JSON. Never wrap `redirect()` inside `try/catch`.

- [ ] **Step 3: Implement snapshot, secret, command, and heartbeat handlers**

Each handler must set:

```ts
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
```

Read the room-scoped capability with async cookies, call one service method, and map typed errors to 400/401/404/409/410/429/503 without returning database messages. Before create/join/snapshot/command, HMAC the first trusted `x-forwarded-for` address and call `check_online_rate_limit` with `10/600s`, `30/600s`, `240/300s`, and `120/300s` respectively:

```ts
import "server-only";
import { createHmac } from "node:crypto";
export function requestKey(request: Request) {
  const secret = process.env.ROOM_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("ROOM_RATE_LIMIT_SECRET is not configured");
  const address = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  return createHmac("sha256", secret).update(address).digest("hex");
}
```

- [ ] **Step 4: Verify focused tests and generated route types**

Run: `pnpm test -- src/app/api/online/rooms/routes.test.ts src/online/request-rate-limit.test.ts && pnpm build`

Expected: route tests PASS; Next type generation accepts awaited `RouteContext.params`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/online/rooms src/online/request-rate-limit.ts src/online/request-rate-limit.test.ts
git commit -m "add online room api"
```

### Task 7: Add the Homepage Online Entry

**Files:**
- Create: `src/components/game/game-mode-setup.tsx`
- Create: `src/components/game/online-setup.tsx`
- Create: `src/components/game/game-mode-setup.test.tsx`
- Modify: `src/components/game/game-experience.tsx`
- Modify: `src/components/game/setup-screen.tsx`
- Modify: `src/components/game/game-experience.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: Local/Online tabs and a create-room form that navigates to `/game/[roomId]`.
- Consumes: `POST /api/online/rooms`.

- [ ] **Step 1: Write failing UI tests**

Assert Local remains default and starts a six-player handoff exactly as today. Switch to Online, assert player-count and custom-word controls disappear, submit `Maya` + `Food`, verify the API body, and verify `router.push('/game/<id>')`. Assert server errors render in a `role="alert"` without erasing form values.

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- src/components/game/game-mode-setup.test.tsx src/components/game/game-experience.test.tsx`

Expected: FAIL because Online mode is not rendered.

- [ ] **Step 3: Extract mode selection without adding network state to the local reducer**

`GameModeSetup` owns only `"local" | "online"`. It renders the existing `SetupScreen` unchanged for Local and `OnlineSetup` for Online. `OnlineSetup` owns nickname/category/submission state, POSTs JSON, and navigates only after a successful response.

- [ ] **Step 4: Add responsive and accessible styles**

Reuse the existing cobalt/coral variables, `.mode-switch`, focus rings, 44px touch targets, and reduced-motion rules. Add `.game-mode-switch`, `.online-setup-fields`, `.online-error`, and `.online-loading`; do not add gradients, glass, or a second visual system.

- [ ] **Step 5: Verify local regression and online entry**

Run: `pnpm test -- src/components/game && pnpm lint`

Expected: all game component tests PASS; lint PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/game src/app/globals.css
git commit -m "add online room entry"
```

### Task 8: Build the Dynamic Room Route, Join Screen, and Lobby

**Files:**
- Create: `src/app/game/[roomId]/layout.tsx`
- Create: `src/app/game/[roomId]/page.tsx`
- Create: `src/app/game/[roomId]/page.test.tsx`
- Create: `src/components/online/online-room-controller.tsx`
- Create: `src/components/online/join-room-screen.tsx`
- Create: `src/components/online/lobby-screen.tsx`
- Create: `src/components/online/lobby-screen.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: noindex dynamic room entry and lobby screens.
- Consumes: snapshot/join/command endpoints and `RoomSnapshot`.

- [ ] **Step 1: Write failing route and lobby tests**

Test awaited params, invalid/missing/closed room redirect to `/`, static robots metadata, guest join form, Copy button calling `navigator.clipboard.writeText(location.href)`, roster state, 3-player start enablement, guest `Waiting for host`, and host-only controls.

- [ ] **Step 2: Implement the server route correctly for Next.js 16**

```tsx
export const metadata: Metadata = { robots: { index: false, follow: false } };
async function getEntrySnapshot(roomId: string) {
  const capability = await readRoomCapability(roomId);
  try { return await createRoomService().snapshot(roomId, capability); }
  catch (error) {
    if (error instanceof RoomServiceError && (error.code === "not-found" || error.code === "room-closed")) return null;
    throw error;
  }
}
export default async function OnlineRoomPage({ params }: PageProps<"/game/[roomId]">) {
  const { roomId } = await params;
  if (!roomIdSchema.safeParse(roomId).success) redirect("/");
  const snapshot = await getEntrySnapshot(roomId);
  if (!snapshot || snapshot.phase === "closed") redirect("/");
  return <OnlineRoomController roomId={roomId} initialSnapshot={snapshot} needsNickname={snapshot.viewerPlayerId === null} />;
}
```

Keep runtime cookie/database access inside the async server entry; do not use `generateStaticParams` or cache the result.

- [ ] **Step 3: Implement join and lobby components**

`JoinRoomScreen` validates the nickname client-side, POSTs to `/join`, and replaces state with the returned snapshot. `LobbyScreen` renders the link, active/waiting/disconnected roster, category, capacity, Copy status, and host-only Start button. It never displays secret data.

- [ ] **Step 4: Style the ad-free mobile-first room shell**

Add `.online-room-shell`, `.room-panel`, `.invite-row`, `.room-roster`, `.player-state`, `.host-badge`, and responsive rules. Match existing panel widths and typography; keep primary actions above the fold on 390×844.

- [ ] **Step 5: Run route/component tests and build**

Run: `pnpm test -- src/app/game src/components/online/lobby-screen.test.tsx && pnpm build`

Expected: tests PASS; build lists dynamic route `ƒ /game/[roomId]`.

- [ ] **Step 6: Commit**

```bash
git add src/app/game src/components/online src/app/globals.css
git commit -m "add online lobby experience"
```

### Task 9: Add Private Word, Realtime Sync, Discussion, and Reveal

**Files:**
- Create: `src/components/online/use-room-realtime.ts`
- Create: `src/components/online/use-room-realtime.test.tsx`
- Create: `src/components/online/online-secret-screen.tsx`
- Create: `src/components/online/online-secret-screen.test.tsx`
- Create: `src/components/online/online-discussion-screen.tsx`
- Create: `src/components/online/online-reveal-flow.tsx`
- Create: `src/components/online/online-reveal-flow.test.tsx`
- Modify: `src/components/online/online-room-controller.tsx`
- Modify: `src/components/game/secret-word-screen.tsx`
- Modify: `src/components/game/secret-word-screen.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces complete client phases and `useRoomRealtime({ roomId, version, onInvalidate })`.
- Consumes secret, snapshot, command, and heartbeat endpoints plus Realtime Broadcast.

- [ ] **Step 1: Write failing privacy and synchronization tests**

Start with these synchronization assertions, then add focused component tests for hold/release, blur hiding, Ready once, host-only controls, staged words, and replay/cancel/close confirmations:

```ts
it("subscribes to the opaque room topic and refetches only for a newer version", () => {
  const onInvalidate = vi.fn();
  renderHook(() => useRoomRealtime({ roomId: "AbcdefghijklmnopQRSTUV", version: 4, onInvalidate }));
  expect(mockChannel).toHaveBeenCalledWith("room:AbcdefghijklmnopQRSTUV");
  emitBroadcast({ version: 4 }); expect(onInvalidate).not.toHaveBeenCalled();
  emitBroadcast({ version: 5 }); expect(onInvalidate).toHaveBeenCalledOnce();
});

it("falls back to five-second polling after a channel error", () => {
  vi.useFakeTimers();
  const onInvalidate = vi.fn();
  renderHook(() => useRoomRealtime({ roomId, version: 4, onInvalidate }));
  emitStatus("CHANNEL_ERROR");
  vi.advanceTimersByTime(5_000);
  expect(onInvalidate).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Extract a reusable private-word control**

Move only the reveal mechanics from the local `SecretWordScreen` into a private presentational helper within the same file or `src/components/game/private-word-control.tsx`. Keep local props and behavior unchanged; online passes nickname text and an async Ready callback. Re-run the local privacy tests before adding online behavior.

- [ ] **Step 3: Implement public Broadcast invalidation with polling fallback**

```ts
const channel = client.channel(`room:${roomId}`)
  .on("broadcast", { event: "room_changed" }, ({ payload }) => {
    if (typeof payload?.version === "number" && payload.version > versionRef.current) onInvalidate();
  })
  .subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") startPolling(5000);
    if (status === "SUBSCRIBED") stopPolling();
  });
return () => { stopPolling(); void client.removeChannel(channel); };
```

The hook never trusts Broadcast payloads as state; it only requests a fresh no-store snapshot.

- [ ] **Step 4: Implement synchronized phase screens**

`OnlineSecretScreen` GETs `/secret` once per phase, keeps the word in component memory only, and POSTs `ready`. `OnlineDiscussionScreen` shows external discussion instructions and host-only two-second reveal hold. `OnlineRevealFlow` shows imposter nickname/word first, civilian word second, and host-only Play again/End room. `OnlineRoomController` owns command pending/error state, refetch serialization, heartbeat, and phase selection.

- [ ] **Step 5: Verify privacy and convergence tests**

Run: `pnpm test -- src/components/game/secret-word-screen.test.tsx src/components/online && pnpm lint`

Expected: all focused tests PASS; no hook dependency or accessibility lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/game/secret-word-screen.tsx src/components/game/secret-word-screen.test.tsx src/components/online src/app/globals.css
git commit -m "add synchronized online rounds"
```

### Task 10: Enforce Lifecycle Cleanup, SEO, and Analytics Isolation

**Files:**
- Create: `supabase/migrations/20260716000400_online_room_cron.sql`
- Modify: `supabase/tests/online_rooms.test.sql`
- Create: `src/components/marketing-scripts.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/robots.ts`
- Modify: `src/app/seo.test.ts`
- Modify: `STRUCTURE.md`

**Interfaces:**
- Produces: one-minute cleanup job, marketing-only third-party scripts, and non-indexable room routes.
- Consumes: `public.cleanup_online_rooms()` from Task 5.

- [ ] **Step 1: Write failing SEO/privacy and cleanup tests**

Assert homepage still has analytics scripts, `/game` route modules do not import `MarketingScripts`, robots disallows `/game/`, sitemap remains homepage-only, FAQ no longer claims online rooms do not exist, and cleanup closes five-minute-host-away/six-hour-expired rooms while retaining a tombstone.

- [ ] **Step 2: Generate and implement the Cron migration**

Run `supabase migration new online_room_cron`, rename it to `supabase/migrations/20260716000400_online_room_cron.sql`, and add:

```sql
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('cleanup-online-rooms', '* * * * *', $$select public.cleanup_online_rooms();$$);
```

Do not insert directly into `cron.job`; current Supabase requires `cron.schedule()`.

- [ ] **Step 3: Move third-party scripts out of the root layout**

Remove AdSense, Plausible, and Google Analytics from `src/app/layout.tsx`. Render a focused `MarketingScripts` component only from `src/app/page.tsx`, preserving current IDs and configuration. This guarantees online room pages do not load ad/analytics scripts.

- [ ] **Step 4: Update public copy and crawler boundaries**

Change the FAQ answer to: `No. Local play still works instantly with no account or room. Online rooms are optional when everyone wants to use their own device.` Add `disallow: "/game/"` to robots while retaining the homepage allow rule and sitemap. Document `/game/[roomId]` as dynamic, private, noindex, and excluded from the sitemap in `STRUCTURE.md`.

- [ ] **Step 5: Verify migration and SEO tests**

Run:

```bash
supabase db reset
supabase test db supabase/tests/online_rooms.test.sql
pnpm test -- src/app/page.test.tsx src/app/seo.test.ts
pnpm build
```

Expected: tests PASS; homepage remains static; room route remains dynamic; no room route output contains analytics script IDs.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260716000400_online_room_cron.sql supabase/tests/online_rooms.test.sql src/components/marketing-scripts.tsx src/app/layout.tsx src/app/page.tsx src/app/page.test.tsx src/app/robots.ts src/app/seo.test.ts STRUCTURE.md
git commit -m "harden online room lifecycle"
```

### Task 11: Add Multi-Browser Verification and Operations Documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/online-room.spec.ts`
- Create: `docs/online-mode-operations.md`
- Modify: `README.md`

**Interfaces:**
- Produces: repeatable three-browser acceptance test and deploy/runbook.
- Consumes: local Supabase, all room endpoints, and complete UI.

- [ ] **Step 1: Configure Playwright against the local app**

```ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: { command: "pnpm dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
});
```

- [ ] **Step 2: Write the failing three-context acceptance test**

Create one host context and two guest contexts. Create a room, copy/read its URL, join unique nicknames, start, assert each context sees one private word and no role label, mark all Ready, reveal in two stages, play again, join a late fourth player during the next active round and assert waiting, close the room, and assert every context plus a fresh visit ends at `/`.

Run: `pnpm exec playwright test e2e/online-room.spec.ts`

Expected before final fixes: FAIL at the first uncovered integration mismatch; use the trace to fix the owning task's module rather than adding test-only branches.

- [ ] **Step 3: Document exact operations**

`docs/online-mode-operations.md` must include: create/link a Supabase project, apply migrations, retrieve project URL/publishable/service-role keys, create `ROOM_RATE_LIMIT_SECRET` with `openssl rand -base64 32`, configure local/Vercel env, verify Cron job, run pgTAP/advisors, inspect Realtime/Postgres logs without logging words, rollback by reverting app deployment before reversing schema, and confirm closed-link redirects.

Update README commands:

```bash
supabase start
supabase db reset
pnpm test
pnpm exec playwright test
pnpm lint
pnpm build
```

- [ ] **Step 4: Run the complete verification gate**

Run:

```bash
supabase db reset
supabase test db supabase/tests/online_rooms.test.sql
supabase db advisors --local
pnpm test
pnpm exec playwright test
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits 0; Vitest includes all old local tests; Playwright passes the multi-context flow; build reports `/` static and `/game/[roomId]` dynamic.

- [ ] **Step 5: Commit and push**

```bash
git add playwright.config.ts e2e/online-room.spec.ts docs/online-mode-operations.md README.md
git commit -m "verify online multiplayer rooms"
git push -u origin agent/online-multiplayer-design
```

After push, open a draft PR from `agent/online-multiplayer-design` to `main` with the design/spec links, migration/security summary, checks run, and required Vercel/Supabase environment configuration.
