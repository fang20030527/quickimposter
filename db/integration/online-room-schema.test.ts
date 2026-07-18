import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeOwnerPool,
  ownerPool,
  resetDatabase,
  withRuntimeRole,
} from "./database-test-utils";

const SIX_HOURS_MS = 6 * 60 * 60 * 1_000;
const databaseDescribe = process.env.DATABASE_URL_TEST
  ? describe
  : describe.skip;

async function insertRoom(id = "A".repeat(22)) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SIX_HOURS_MS);

  await ownerPool().query(
    `
      insert into private.rooms (id, category, created_at, expires_at)
      values ($1, 'Food', $2, $3)
    `,
    [id, createdAt, expiresAt],
  );

  return id;
}

async function insertPlayer(
  roomId: string,
  nickname: string,
  normalizedNickname: string,
  joinOrder: number,
  state = "active",
) {
  const id = randomUUID();
  const createdAt = new Date();

  await ownerPool().query(
    `
      insert into private.players (
        id, room_id, nickname, normalized_nickname, join_order,
        state, last_seen_at, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7)
    `,
    [id, roomId, nickname, normalizedNickname, joinOrder, state, createdAt],
  );

  return id;
}

databaseDescribe("online room database schema", () => {
  beforeEach(resetDatabase);
  afterAll(closeOwnerPool);

  it("creates all private tables", async () => {
    const result = await ownerPool().query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'private'
      order by table_name
    `);

    expect(result.rows.map((row) => row.table_name)).toEqual([
      "players",
      "rate_limit_buckets",
      "room_sessions",
      "rooms",
      "round_players",
      "rounds",
    ]);
  });

  it("creates a no-login runtime role with schema usage only", async () => {
    const role = await ownerPool().query<{ rolcanlogin: boolean }>(`
      select rolcanlogin
      from pg_catalog.pg_roles
      where rolname = 'quickimposter_app'
    `);
    const privileges = await ownerPool().query<{
      can_create: boolean;
      can_use: boolean;
    }>(`
      select
        has_schema_privilege('quickimposter_app', 'private', 'CREATE') as can_create,
        has_schema_privilege('quickimposter_app', 'private', 'USAGE') as can_use
    `);

    expect(role.rows).toEqual([{ rolcanlogin: false }]);
    expect(privileges.rows).toEqual([{ can_create: false, can_use: true }]);
  });

  it("denies runtime-role table reads", async () => {
    await expect(
      withRuntimeRole((client) =>
        client.query("select * from private.room_sessions"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("denies runtime-role table writes", async () => {
    await expect(
      withRuntimeRole((client) =>
        client.query(`
          insert into private.rate_limit_buckets (
            key_digest, action, window_started_at, expires_at
          )
          values (
            repeat('a', 64), 'create', clock_timestamp(),
            clock_timestamp() + interval '10 minutes'
          )
        `),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("denies runtime-role sequence access", async () => {
    await ownerPool().query(
      "create sequence private.runtime_privilege_probe",
    );

    try {
      await expect(
        withRuntimeRole((client) =>
          client.query("select nextval('private.runtime_privilege_probe')"),
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await ownerPool().query(
        "drop sequence if exists private.runtime_privilege_probe",
      );
    }
  });

  it("accepts exactly the room and player lifecycle values", async () => {
    const result = await ownerPool().query<{
      constraint_name: string;
      definition: string;
    }>(`
      select con.conname as constraint_name,
             pg_catalog.pg_get_constraintdef(con.oid) as definition
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_namespace namespace
        on namespace.oid = con.connamespace
      where namespace.nspname = 'private'
        and con.conname in ('rooms_phase_check', 'players_state_check')
      order by con.conname
    `);

    expect(result.rows).toEqual([
      {
        constraint_name: "players_state_check",
        definition: expect.stringMatching(
          /active.*waiting.*disconnected.*removed/,
        ),
      },
      {
        constraint_name: "rooms_phase_check",
        definition: expect.stringMatching(
          /lobby.*private-reveal.*discussion.*imposter-revealed.*civilian-revealed.*closed/,
        ),
      },
    ]);
  });

  it("requires the hard expiry to be exactly six hours after creation", async () => {
    const createdAt = new Date();

    await expect(
      ownerPool().query(
        `
          insert into private.rooms (id, category, created_at, expires_at)
          values ($1, 'Food', $2, $3)
        `,
        [
          "B".repeat(22),
          createdAt,
          new Date(createdAt.getTime() + SIX_HOURS_MS - 1_000),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("accepts only 64-character lowercase capability digests", async () => {
    const roomId = await insertRoom();
    const playerId = await insertPlayer(roomId, "Maya", "maya", 1);
    const createdAt = new Date();

    await expect(
      ownerPool().query(
        `
          insert into private.room_sessions (
            id, room_id, player_id, player_token_digest, expires_at, created_at
          )
          values ($1, $2, $3, $4, $5, $6)
        `,
        [
          randomUUID(),
          roomId,
          playerId,
          "A".repeat(64),
          new Date(createdAt.getTime() + SIX_HOURS_MS),
          createdAt,
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      ownerPool().query(
        `
          insert into private.room_sessions (
            id, room_id, player_id, player_token_digest,
            host_token_digest, expires_at, created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          randomUUID(),
          roomId,
          playerId,
          "b".repeat(64),
          "B".repeat(64),
          new Date(createdAt.getTime() + SIX_HOURS_MS),
          createdAt,
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      ownerPool().query(
        `
          insert into private.room_sessions (
            id, room_id, player_id, player_token_digest, expires_at, created_at
          )
          values ($1, $2, $3, $4, $5, $6)
        `,
        [
          randomUUID(),
          roomId,
          playerId,
          "a".repeat(64),
          new Date(createdAt.getTime() + SIX_HOURS_MS),
          createdAt,
        ],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it("reserves normalized nicknames only for non-removed players", async () => {
    const roomId = await insertRoom();
    await insertPlayer(roomId, "Maya", "maya", 1);
    const removedId = await insertPlayer(
      roomId,
      "MAYA",
      "maya",
      2,
      "removed",
    );

    await expect(
      ownerPool().query(
        "update private.players set state = 'waiting' where id = $1",
        [removedId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("stores one immutable assignment per round and player", async () => {
    const roomId = await insertRoom();
    const playerId = await insertPlayer(roomId, "Maya", "maya", 1);
    const roundId = randomUUID();

    await ownerPool().query(
      `
        insert into private.rounds (
          id, room_id, word_pair_id, civilian_word, imposter_word
        )
        values ($1, $2, 'food-1', 'Apple', 'Pear')
      `,
      [roundId, roomId],
    );
    await ownerPool().query(
      `
        insert into private.round_players (
          room_id, round_id, player_id, participation_order, assignment
        )
        values ($1, $2, $3, 1, 'civilian')
      `,
      [roomId, roundId, playerId],
    );

    await expect(
      ownerPool().query(
        `
          insert into private.round_players (
            room_id, round_id, player_id, participation_order, assignment
          )
          values ($1, $2, $3, 2, 'imposter')
        `,
        [roomId, roundId, playerId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects a round participant from another room", async () => {
    const firstRoomId = await insertRoom("C".repeat(22));
    const secondRoomId = await insertRoom("D".repeat(22));
    const otherRoomPlayerId = await insertPlayer(
      secondRoomId,
      "Noah",
      "noah",
      1,
    );
    const roundId = randomUUID();

    await ownerPool().query(
      `
        insert into private.rounds (
          id, room_id, word_pair_id, civilian_word, imposter_word
        )
        values ($1, $2, 'food-1', 'Apple', 'Pear')
      `,
      [roundId, firstRoomId],
    );

    await expect(
      ownerPool().query(
        `
          insert into private.round_players (
            room_id, round_id, player_id, participation_order, assignment
          )
          values ($1, $2, $3, 1, 'civilian')
        `,
        [firstRoomId, roundId, otherRoomPlayerId],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("creates every room, player, session, round, and assignment foreign key", async () => {
    const result = await ownerPool().query<{ constraint_name: string }>(`
      select con.conname as constraint_name
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_namespace namespace
        on namespace.oid = con.connamespace
      where namespace.nspname = 'private'
        and con.contype = 'f'
      order by con.conname
    `);

    expect(result.rows.map((row) => row.constraint_name)).toEqual([
      "players_room_id_fkey",
      "room_sessions_room_player_fkey",
      "rooms_current_round_fkey",
      "rooms_host_player_fkey",
      "round_players_room_player_fkey",
      "round_players_room_round_fkey",
      "rounds_imposter_assignment_fkey",
      "rounds_room_id_fkey",
      "rounds_room_imposter_fkey",
    ]);
  });

  it("creates the lookup and cleanup indexes", async () => {
    const result = await ownerPool().query<{ indexname: string }>(`
      select indexname
      from pg_catalog.pg_indexes
      where schemaname = 'private'
    `);
    const names = result.rows.map((row) => row.indexname);

    expect(names).toEqual(
      expect.arrayContaining([
        "players_active_nickname_key",
        "players_room_membership_idx",
        "players_heartbeat_cleanup_idx",
        "room_sessions_lookup_idx",
        "rounds_active_room_idx",
        "rooms_host_heartbeat_cleanup_idx",
        "rooms_expiry_cleanup_idx",
        "rate_limit_buckets_expiry_idx",
      ]),
    );
  });

  it("makes nickname uniqueness conditional on non-removed state", async () => {
    const result = await ownerPool().query<{ indexdef: string }>(`
      select indexdef
      from pg_catalog.pg_indexes
      where schemaname = 'private'
        and indexname = 'players_active_nickname_key'
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].indexdef).toMatch(
      /UNIQUE INDEX.*\(room_id, normalized_nickname\).*WHERE.*state.*<>.*removed/i,
    );
  });

  it("documents that raw capability tokens must never be stored", async () => {
    const result = await ownerPool().query<{ comment: string }>(`
      select pg_catalog.obj_description(class.oid, 'pg_class') as comment
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'private'
        and class.relkind = 'r'
      order by class.relname
    `);

    expect(result.rows).toHaveLength(6);
    expect(
      result.rows.every(({ comment }) =>
        comment.includes("Raw capability tokens must never be stored"),
      ),
    ).toBe(true);
  });

  it("records the migration with a SHA-1 checksum", async () => {
    const result = await ownerPool().query<{ hash: string; name: string }>(`
      select name, hash
      from public.migrations
      where id = 1
    `);

    expect(result.rows).toEqual([
      {
        name: "online_room_schema",
        hash: expect.stringMatching(/^[0-9a-f]{40}$/),
      },
    ]);
  });
});
