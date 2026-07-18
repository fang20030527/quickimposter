import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeOwnerPool,
  ownerPool,
  resetDatabase,
  withRuntimeRoleCommitted,
} from "./database-test-utils";

const databaseDescribe = process.env.DATABASE_URL_TEST ? describe : describe.skip;

const ROOM_ID = "A".repeat(22);

function digest(value: string = randomUUID()) {
  return createHash("sha256").update(value).digest("hex");
}

function player(nickname = "Maya", normalizedNickname = "maya") {
  return {
    id: randomUUID(),
    nickname,
    normalizedNickname,
  };
}

function session(playerId: string, host = false) {
  return {
    id: randomUUID(),
    playerId,
    playerTokenDigest: digest(),
    hostTokenDigest: host ? digest() : null,
  };
}

async function createRoom(roomId = ROOM_ID) {
  const host = player();
  const hostSession = session(host.id, true);
  const result = await withRuntimeRoleCommitted((client) =>
    client.query<{ result: Record<string, unknown> }>(
      "select private.create_online_room($1::jsonb, $2::jsonb, $3::jsonb) as result",
      [{ id: roomId, category: "Food", expiresAt: "2000-01-01" }, host, hostSession],
    ),
  );
  return { host, session: hostSession, snapshot: result.rows[0].result };
}

async function joinRoom(
  nickname: string,
  normalizedNickname = nickname.toLocaleLowerCase("en-US"),
) {
  const joiningPlayer = player(nickname, normalizedNickname);
  const joiningSession = session(joiningPlayer.id);
  const result = await withRuntimeRoleCommitted((client) =>
    client.query<{ result: Record<string, unknown> }>(
      "select private.join_online_room($1, $2::jsonb, $3::jsonb) as result",
      [ROOM_ID, joiningPlayer, joiningSession],
    ),
  );
  return { player: joiningPlayer, session: joiningSession, snapshot: result.rows[0].result };
}

databaseDescribe("online room lobby persistence", () => {
  beforeEach(resetDatabase);
  afterAll(closeOwnerPool);

  it("creates a lobby with one host and one room-scoped session", async () => {
    const { snapshot } = await createRoom();

    expect(snapshot).toEqual(
      expect.objectContaining({ roomId: ROOM_ID, phase: "lobby", version: 0 }),
    );
    await expect(
      ownerPool().query("select count(*)::int as count from private.rooms"),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(
      ownerPool().query("select count(*)::int as count from private.players"),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(
      ownerPool().query("select count(*)::int as count from private.room_sessions"),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it("uses one database timestamp for the exact six-hour expiry", async () => {
    await createRoom();
    const result = await ownerPool().query<{
      exact_expiry: boolean;
      session_matches: boolean;
    }>(`
      select
        expires_at = created_at + interval '6 hours' as exact_expiry,
        (select session.expires_at = room.expires_at
         from private.room_sessions as session
         where session.room_id = room.id) as session_matches
      from private.rooms as room
      where id = '${ROOM_ID}'
    `);
    expect(result.rows).toEqual([{ exact_expiry: true, session_matches: true }]);
  });

  it("maps a duplicate normalized nickname to nickname-taken", async () => {
    await createRoom();
    await expect(joinRoom("MAYA", "maya")).rejects.toMatchObject({
      message: "nickname-taken",
    });
  });

  it("serializes concurrent joins for the final room slot", async () => {
    await createRoom();
    for (let index = 2; index <= 11; index += 1) {
      await joinRoom(`Player ${index}`, `player ${index}`);
    }

    const results = await Promise.allSettled([
      joinRoom("Player 12", "player 12"),
      joinRoom("Player 13", "player 13"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ message: "room-full" }),
      }),
    ]);
  });

  it("places players joining an active game in the waiting state", async () => {
    await createRoom();
    await ownerPool().query(
      "update private.rooms set phase = 'discussion' where id = $1",
      [ROOM_ID],
    );
    const joined = await joinRoom("Noah");

    expect(joined.snapshot).toEqual(
      expect.objectContaining({
        phase: "discussion",
        players: expect.arrayContaining([
          expect.objectContaining({ id: joined.player.id, state: "waiting" }),
        ]),
      }),
    );
  });

  it("returns an unchanged marker for a known version", async () => {
    const created = await createRoom();
    const result = await withRuntimeRoleCommitted((client) =>
      client.query<{ result: unknown }>(
        "select private.get_online_room_snapshot($1, $2, $3, $4) as result",
        [ROOM_ID, created.session.id, created.session.playerTokenDigest, 0],
      ),
    );
    expect(result.rows).toEqual([{ result: { changed: false, version: 0 } }]);
  });

  it("returns only camelCase public snapshot fields and redacts round secrets", async () => {
    const created = await createRoom();
    const roundId = randomUUID();
    await ownerPool().query(
        `insert into private.rounds
           (id, room_id, word_pair_id, civilian_word, imposter_word)
         values ($1, $2, 'secret-pair-id', 'Pizza', 'Pasta')`,
        [roundId, ROOM_ID],
    );
    await ownerPool().query(
        `insert into private.round_players
           (room_id, round_id, player_id, participation_order, assignment)
         values ($1, $2, $3, 1, 'imposter')`,
        [ROOM_ID, roundId, created.host.id],
    );
    await ownerPool().query(
        "update private.rounds set imposter_player_id = $1 where id = $2",
        [created.host.id, roundId],
    );
    await ownerPool().query(
        `update private.rooms
         set current_round_id = $1, phase = 'private-reveal', version = 1
         where id = $2`,
        [roundId, ROOM_ID],
    );

    const result = await withRuntimeRoleCommitted((client) =>
      client.query<{ result: { changed: true; snapshot: Record<string, unknown> } }>(
        "select private.get_online_room_snapshot($1, $2, $3, $4) as result",
        [ROOM_ID, created.session.id, created.session.playerTokenDigest, null],
      ),
    );
    const snapshot = result.rows[0].result.snapshot;
    expect(Object.keys(snapshot).sort()).toEqual([
      "category",
      "expiresAt",
      "hostAwaySince",
      "participantCount",
      "phase",
      "players",
      "readyCount",
      "result",
      "roomId",
      "version",
      "viewerIsHost",
      "viewerPlayerId",
    ]);
    expect(snapshot).toEqual(
      expect.objectContaining({
        phase: "private-reveal",
        result: null,
        viewerPlayerId: created.host.id,
        viewerIsHost: true,
      }),
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      /secret-pair-id|Pizza|Pasta|playerTokenDigest|hostTokenDigest|assignment|imposterPlayer/i,
    );
  });

  it("accepts only a matching unrevoked unexpired heartbeat capability", async () => {
    const created = await createRoom();
    const before = await ownerPool().query<{ host_last_seen_at: Date }>(
      "select host_last_seen_at from private.rooms where id = $1",
      [ROOM_ID],
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(
      withRuntimeRoleCommitted((client) =>
        client.query(
          "select private.heartbeat_online_room($1, $2, $3)",
          [ROOM_ID, created.session.id, created.session.playerTokenDigest],
        ),
      ),
    ).resolves.toBeDefined();
    const after = await ownerPool().query<{ host_last_seen_at: Date }>(
      "select host_last_seen_at from private.rooms where id = $1",
      [ROOM_ID],
    );
    expect(after.rows[0].host_last_seen_at.getTime()).toBeGreaterThan(
      before.rows[0].host_last_seen_at.getTime(),
    );

    await ownerPool().query(
      "update private.room_sessions set revoked_at = clock_timestamp() where id = $1",
      [created.session.id],
    );
    await expect(
      withRuntimeRoleCommitted((client) =>
        client.query(
          "select private.heartbeat_online_room($1, $2, $3)",
          [ROOM_ID, created.session.id, created.session.playerTokenDigest],
        ),
      ),
    ).rejects.toMatchObject({ message: "unauthorized" });

    await ownerPool().query(
      `update private.room_sessions
       set revoked_at = null, expires_at = clock_timestamp() - interval '1 second'
       where id = $1`,
      [created.session.id],
    );
    await expect(
      withRuntimeRoleCommitted((client) =>
        client.query(
          "select private.heartbeat_online_room($1, $2, $3)",
          [ROOM_ID, created.session.id, created.session.playerTokenDigest],
        ),
      ),
    ).rejects.toMatchObject({ message: "unauthorized" });
  });

  it("closes a host-stale room and leaves a secret-free tombstone", async () => {
    await createRoom();
    await ownerPool().query(
      `update private.rooms
       set host_last_seen_at = clock_timestamp() - interval '5 minutes 1 second'
       where id = $1`,
      [ROOM_ID],
    );
    await withRuntimeRoleCommitted((client) =>
      client.query("select private.cleanup_online_room($1)", [ROOM_ID]),
    );
    const room = await ownerPool().query(
      "select phase, version, closed_at is not null as closed from private.rooms where id = $1",
      [ROOM_ID],
    );
    const sessionRows = await ownerPool().query(
      "select revoked_at is not null as revoked from private.room_sessions where room_id = $1",
      [ROOM_ID],
    );
    expect(room.rows).toEqual([{ phase: "closed", version: 1, closed: true }]);
    expect(sessionRows.rows).toEqual([{ revoked: true }]);
  });

  it("closes a room at its hard six-hour expiry even with a fresh host", async () => {
    await createRoom();
    await ownerPool().query(
      `with instant as (select clock_timestamp() as value)
       update private.rooms
       set created_at = instant.value - interval '6 hours 1 second',
           updated_at = instant.value,
           expires_at = instant.value - interval '1 second',
           host_last_seen_at = instant.value
       from instant
       where id = $1`,
      [ROOM_ID],
    );
    await withRuntimeRoleCommitted((client) =>
      client.query("select private.cleanup_online_room($1)", [ROOM_ID]),
    );
    await expect(
      ownerPool().query("select phase from private.rooms where id = $1", [ROOM_ID]),
    ).resolves.toMatchObject({ rows: [{ phase: "closed" }] });
  });

  it("atomically enforces independent fixed-window rate limits", async () => {
    const key = digest("request identity");
    const check = (action: string) =>
      withRuntimeRoleCommitted((client) =>
        client.query<{ allowed: boolean }>(
          "select private.check_online_rate_limit($1, $2, $3, $4) as allowed",
          [key, action, 2, 60],
        ),
      );

    expect((await check("create")).rows[0].allowed).toBe(true);
    expect((await check("create")).rows[0].allowed).toBe(true);
    expect((await check("create")).rows[0].allowed).toBe(false);
    expect((await check("join")).rows[0].allowed).toBe(true);

    const concurrent = await Promise.all([
      withRuntimeRoleCommitted((client) =>
        client.query<{ allowed: boolean }>(
          "select private.check_online_rate_limit($1, $2, 1, 60) as allowed",
          [digest("concurrent key"), "snapshot"],
        ),
      ),
      withRuntimeRoleCommitted((client) =>
        client.query<{ allowed: boolean }>(
          "select private.check_online_rate_limit($1, $2, 1, 60) as allowed",
          [digest("concurrent key"), "snapshot"],
        ),
      ),
    ]);
    expect(concurrent.map((result) => result.rows[0].allowed).sort()).toEqual([
      false,
      true,
    ]);
  });

  it("rejects null fixed-window rate-limit settings as invalid requests", async () => {
    await expect(
      withRuntimeRoleCommitted((client) =>
        client.query(
          "select private.check_online_rate_limit($1, $2, $3, $4)",
          [digest("invalid settings"), "join", null, null],
        ),
      ),
    ).rejects.toMatchObject({ message: "invalid-request" });
  });

  it("grants approved functions only and still denies runtime table reads", async () => {
    const privileges = await ownerPool().query<{
      app_helper: boolean;
      app_all: boolean;
      public_any: boolean;
    }>(`
      with approved(signature) as (values
        ('private.cleanup_online_room(text)'),
        ('private.create_online_room(jsonb,jsonb,jsonb)'),
        ('private.join_online_room(text,jsonb,jsonb)'),
        ('private.get_online_room_snapshot(text,uuid,text,integer)'),
        ('private.heartbeat_online_room(text,uuid,text)'),
        ('private.check_online_rate_limit(text,text,integer,integer)')
      )
      select
        bool_and(has_function_privilege('quickimposter_app', signature, 'EXECUTE'))
          as app_all,
        bool_or(has_function_privilege('public', signature, 'EXECUTE'))
          as public_any,
        has_function_privilege(
          'quickimposter_app',
          'private.build_online_room_snapshot(text,uuid)',
          'EXECUTE'
        ) as app_helper
      from approved
    `);
    expect(privileges.rows).toEqual([
      { app_all: true, app_helper: false, public_any: false },
    ]);
    await expect(
      withRuntimeRoleCommitted((client) =>
        client.query("select current_role as role"),
      ),
    ).resolves.toMatchObject({ rows: [{ role: "quickimposter_app" }] });
    await expect(
      withRuntimeRoleCommitted((client) =>
        client.query("select * from private.room_sessions"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("hardens every lobby function with definer rights and a fixed search path", async () => {
    const functions = await ownerPool().query<{
      name: string;
      prosecdef: boolean;
      settings: string[];
    }>(`
      select procedure.proname as name,
             procedure.prosecdef,
             procedure.proconfig as settings
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'private'
        and procedure.proname in (
          'build_online_room_snapshot',
          'check_online_rate_limit',
          'cleanup_online_room',
          'create_online_room',
          'get_online_room_snapshot',
          'heartbeat_online_room',
          'join_online_room'
        )
      order by procedure.proname
    `);
    expect(functions.rows).toHaveLength(7);
    expect(functions.rows).toEqual(
      functions.rows.map((row) => ({
        ...row,
        prosecdef: true,
        settings: ["search_path=pg_catalog, private"],
      })),
    );
  });
});
