import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeOwnerPool,
  ownerPool,
  resetDatabase,
  withRuntimeRoleCommitted,
} from "./database-test-utils";

const databaseDescribe = process.env.DATABASE_URL_TEST ? describe : describe.skip;
const ROOM_ID = "R".repeat(22);

function digest(value: string = randomUUID()) {
  return createHash("sha256").update(value).digest("hex");
}

function player(nickname: string) {
  return {
    id: randomUUID(),
    nickname,
    normalizedNickname: nickname.toLocaleLowerCase("en-US"),
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

async function createRoom(category = "Food") {
  const host = player("Host");
  const hostSession = session(host.id, true);
  await withRuntimeRoleCommitted((client) =>
    client.query(
      "select private.create_online_room($1::jsonb, $2::jsonb, $3::jsonb)",
      [{ id: ROOM_ID, category }, host, hostSession],
    ),
  );
  return { host, session: hostSession };
}

async function joinRoom(nickname: string) {
  const joinedPlayer = player(nickname);
  const joinedSession = session(joinedPlayer.id);
  await withRuntimeRoleCommitted((client) =>
    client.query(
      "select private.join_online_room($1, $2::jsonb, $3::jsonb)",
      [ROOM_ID, joinedPlayer, joinedSession],
    ),
  );
  return { player: joinedPlayer, session: joinedSession };
}

function pair(id = "food-apple-orange") {
  return {
    id: randomUUID(),
    wordPairId: id,
    category: "Food",
    civilianWord: "Apple",
    imposterWord: "Orange",
  };
}

async function startRound(
  hostSession: ReturnType<typeof session>,
  expectedVersion: number,
  round = pair(),
) {
  return withRuntimeRoleCommitted((client) =>
    client.query<{ result: { ok: true; version: number } }>(
      `select private.start_online_round(
        $1::text, $2::uuid, $3::text, $4::text, $5::integer, $6::jsonb
      ) as result`,
      [
        ROOM_ID,
        hostSession.id,
        hostSession.playerTokenDigest,
        hostSession.hostTokenDigest,
        expectedVersion,
        round,
      ],
    ),
  );
}

async function threePlayerLobby(category = "Food") {
  const created = await createRoom(category);
  const guestOne = await joinRoom("Guest One");
  const guestTwo = await joinRoom("Guest Two");
  return { created, guestOne, guestTwo };
}

async function getSecret(playerSession: ReturnType<typeof session>) {
  return withRuntimeRoleCommitted((client) =>
    client.query<{ result: { word: string } }>(
      "select private.get_online_player_secret($1, $2, $3) as result",
      [ROOM_ID, playerSession.id, playerSession.playerTokenDigest],
    ),
  );
}

async function getSnapshot(playerSession: ReturnType<typeof session>) {
  return withRuntimeRoleCommitted((client) =>
    client.query<{
      result: { changed: true; snapshot: Record<string, unknown> };
    }>(
      "select private.get_online_room_snapshot($1, $2, $3, null) as result",
      [ROOM_ID, playerSession.id, playerSession.playerTokenDigest],
    ),
  );
}

async function ready(playerSession: ReturnType<typeof session>, expectedVersion: number) {
  return withRuntimeRoleCommitted((client) =>
    client.query<{ result: { ok: true; version: number } }>(
      "select private.mark_online_player_ready($1, $2, $3, $4) as result",
      [ROOM_ID, playerSession.id, playerSession.playerTokenDigest, expectedVersion],
    ),
  );
}

type HostFunction =
  | "reveal_online_imposter"
  | "reveal_online_civilian"
  | "replay_online_room"
  | "cancel_online_round"
  | "close_online_room";

async function hostCommand(
  functionName: HostFunction,
  hostSession: ReturnType<typeof session>,
  expectedVersion: number,
) {
  return withRuntimeRoleCommitted((client) =>
    client.query<{ result: { ok: true; version: number } }>(
      `select private.${functionName}($1, $2, $3, $4, $5) as result`,
      [
        ROOM_ID,
        hostSession.id,
        hostSession.playerTokenDigest,
        hostSession.hostTokenDigest,
        expectedVersion,
      ],
    ),
  );
}

databaseDescribe("online round state machine", () => {
  beforeEach(resetDatabase);
  afterAll(closeOwnerPool);

  it("requires three active players before starting one atomic private round", async () => {
    const created = await createRoom();
    await joinRoom("Guest One");

    await expect(startRound(created.session, 1)).rejects.toMatchObject({
      message: "invalid-request",
    });

    await joinRoom("Guest Two");
    const started = await startRound(created.session, 2);
    expect(started.rows).toEqual([{ result: { ok: true, version: 3 } }]);
    await expect(
      ownerPool().query(
        "select phase, version, current_round_id is not null as has_round from private.rooms where id = $1",
        [ROOM_ID],
      ),
    ).resolves.toMatchObject({
      rows: [{ phase: "private-reveal", version: 3, has_round: true }],
    });
  });

  it("rejects an exact stale version without creating a partial round", async () => {
    const { created } = await threePlayerLobby();

    await expect(startRound(created.session, 1)).rejects.toMatchObject({
      message: "conflict",
    });
    await expect(
      ownerPool().query(
        `select room.version,
                room.current_round_id,
                (select count(*)::int from private.rounds) as round_count
         from private.rooms as room where room.id = $1`,
        [ROOM_ID],
      ),
    ).resolves.toMatchObject({
      rows: [{ version: 2, current_round_id: null, round_count: 0 }],
    });
  });

  it("rejects a pair outside the authoritative room category", async () => {
    const { created } = await threePlayerLobby();
    await expect(
      startRound(created.session, 2, {
        ...pair("animals-lion-tiger"),
        category: "Animals",
      }),
    ).rejects.toMatchObject({ message: "invalid-request" });
  });

  it("rejects incomplete server-selected word pair data", async () => {
    const { created } = await threePlayerLobby();
    const incompletePair = {
      id: randomUUID(),
      wordPairId: "food-apple-orange",
      category: "Food",
      imposterWord: "Orange",
    } as ReturnType<typeof pair>;

    await expect(startRound(created.session, 2, incompletePair)).rejects.toMatchObject({
      message: "invalid-request",
    });
  });

  it("allows a concrete system pair in an All Categories room", async () => {
    const { created } = await threePlayerLobby("All Categories");

    await expect(
      startRound(created.session, 2, {
        id: randomUUID(),
        wordPairId: "food-apple-orange",
        civilianWord: "Apple",
        imposterWord: "Orange",
      } as ReturnType<typeof pair>),
    ).rejects.toMatchObject({ message: "invalid-request" });

    await expect(startRound(created.session, 2)).resolves.toMatchObject({
      rows: [{ result: { ok: true, version: 3 } }],
    });
  });

  it("snapshots one immutable roster with exactly one imposter", async () => {
    const { created } = await threePlayerLobby();
    await startRound(created.session, 2);
    const late = await joinRoom("Late Player");

    const assignments = await ownerPool().query<{
      assignment: string;
      count: number;
    }>(`
      select assignment, count(*)::int as count
      from private.round_players
      where room_id = '${ROOM_ID}'
      group by assignment
      order by assignment
    `);
    expect(assignments.rows).toEqual([
      { assignment: "civilian", count: 2 },
      { assignment: "imposter", count: 1 },
    ]);
    await expect(
      ownerPool().query(
        "select count(*)::int as count from private.round_players where room_id = $1",
        [ROOM_ID],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
    expect(late).toBeDefined();
    await expect(
      ownerPool().query("select state from private.players where id = $1", [late.player.id]),
    ).resolves.toMatchObject({ rows: [{ state: "waiting" }] });
  });

  it("returns only the acting participant's word and rejects a waiting player", async () => {
    const { created, guestOne, guestTwo } = await threePlayerLobby();
    await startRound(created.session, 2);

    const secrets = await Promise.all([
      getSecret(created.session),
      getSecret(guestOne.session),
      getSecret(guestTwo.session),
    ]);
    expect(secrets.map((result) => result.rows[0].result.word).sort()).toEqual([
      "Apple",
      "Apple",
      "Orange",
    ]);
    for (const result of secrets) {
      expect(Object.keys(result.rows[0].result)).toEqual(["word"]);
    }

    const late = await joinRoom("Late Player");
    await expect(getSecret(late.session)).rejects.toMatchObject({
      message: "unauthorized",
    });
  });

  it("marks each participant once and advances only when everyone is ready", async () => {
    const { created, guestOne, guestTwo } = await threePlayerLobby();
    await startRound(created.session, 2);

    await expect(ready(created.session, 3)).resolves.toMatchObject({
      rows: [{ result: { ok: true, version: 4 } }],
    });
    await expect(ready(created.session, 4)).rejects.toMatchObject({
      message: "conflict",
    });
    await ready(guestOne.session, 4);
    await expect(ready(guestTwo.session, 5)).resolves.toMatchObject({
      rows: [{ result: { ok: true, version: 6 } }],
    });

    await expect(
      ownerPool().query(
        `select room.phase, room.version, round.phase as round_phase,
                (select count(*)::int
                 from private.round_players
                 where room_id = room.id and ready_at is not null) as ready_count
         from private.rooms as room
         join private.rounds as round on round.id = room.current_round_id
         where room.id = $1`,
        [ROOM_ID],
      ),
    ).resolves.toMatchObject({
      rows: [
        { phase: "discussion", version: 6, round_phase: "discussion", ready_count: 3 },
      ],
    });
  });

  it("requires the host for staged reveal and admits waiting players on replay", async () => {
    const { created, guestOne, guestTwo } = await threePlayerLobby();
    await startRound(created.session, 2);
    const late = await joinRoom("Late Player");
    await ready(created.session, 4);
    await ready(guestOne.session, 5);
    await ready(guestTwo.session, 6);

    await expect(
      hostCommand("reveal_online_imposter", guestOne.session, 7),
    ).rejects.toMatchObject({ message: "unauthorized" });
    await expect(
      hostCommand("reveal_online_imposter", created.session, 7),
    ).resolves.toMatchObject({ rows: [{ result: { ok: true, version: 8 } }] });

    const imposterSnapshot = (await getSnapshot(created.session)).rows[0].result.snapshot;
    expect(imposterSnapshot).toMatchObject({
      phase: "imposter-revealed",
      version: 8,
      result: {
        imposterNickname: expect.any(String),
        imposterWord: "Orange",
        civilianWord: null,
      },
    });

    await expect(
      hostCommand("reveal_online_civilian", created.session, 8),
    ).resolves.toMatchObject({ rows: [{ result: { ok: true, version: 9 } }] });
    const civilianSnapshot = (await getSnapshot(created.session)).rows[0].result.snapshot;
    expect(civilianSnapshot).toMatchObject({
      phase: "civilian-revealed",
      result: { civilianWord: "Apple" },
    });

    await expect(
      hostCommand("replay_online_room", created.session, 9),
    ).resolves.toMatchObject({ rows: [{ result: { ok: true, version: 10 } }] });
    await expect(
      ownerPool().query(
        `select room.phase, room.version, room.current_round_id,
                player.state as late_state
         from private.rooms as room
         join private.players as player on player.id = $2
         where room.id = $1`,
        [ROOM_ID, late.player.id],
      ),
    ).resolves.toMatchObject({
      rows: [{ phase: "lobby", version: 10, current_round_id: null, late_state: "active" }],
    });

    const startContext = await withRuntimeRoleCommitted((client) =>
      client.query<{ result: { category: string; recentPairIds: string[] } }>(
        "select private.get_online_recent_pair_ids($1, $2, $3, $4) as result",
        [
          ROOM_ID,
          created.session.id,
          created.session.playerTokenDigest,
          created.session.hostTokenDigest,
        ],
      ),
    );
    expect(startContext.rows[0].result).toEqual({
      category: "Food",
      recentPairIds: ["food-apple-orange"],
    });
  }, 60_000);

  it("cancels an incomplete round without reusing any secret assignment", async () => {
    const { created } = await threePlayerLobby();
    await startRound(created.session, 2);
    const late = await joinRoom("Late Player");

    await expect(
      hostCommand("cancel_online_round", created.session, 4),
    ).resolves.toMatchObject({ rows: [{ result: { ok: true, version: 5 } }] });
    await expect(
      ownerPool().query(
        `select room.phase, room.version, room.current_round_id,
                round.cancelled_at is not null as cancelled,
                round.civilian_word, round.imposter_word, round.imposter_player_id,
                player.state as late_state,
                (select count(*)::int from private.round_players where assignment is not null)
                  as assignment_count
         from private.rooms as room
         join private.rounds as round on round.room_id = room.id
         join private.players as player on player.id = $2
         where room.id = $1`,
        [ROOM_ID, late.player.id],
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          phase: "lobby",
          version: 5,
          current_round_id: null,
          cancelled: true,
          civilian_word: null,
          imposter_word: null,
          imposter_player_id: null,
          late_state: "active",
          assignment_count: 0,
        },
      ],
    });
  });

  it("closes from an active phase, revokes sessions, and clears every secret", async () => {
    const { created, guestOne } = await threePlayerLobby();
    await startRound(created.session, 2);

    await expect(
      hostCommand("close_online_room", guestOne.session, 3),
    ).rejects.toMatchObject({ message: "unauthorized" });
    await expect(
      hostCommand("close_online_room", created.session, 3),
    ).resolves.toMatchObject({ rows: [{ result: { ok: true, version: 4 } }] });

    await expect(
      ownerPool().query(
        `select room.phase, room.version, room.closed_at is not null as closed,
                round.civilian_word, round.imposter_word, round.imposter_player_id,
                (select count(*)::int from private.room_sessions where revoked_at is null)
                  as live_sessions,
                (select count(*)::int from private.round_players where assignment is not null)
                  as assignment_count
         from private.rooms as room
         join private.rounds as round on round.id = room.current_round_id
         where room.id = $1`,
        [ROOM_ID],
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          phase: "closed",
          version: 4,
          closed: true,
          civilian_word: null,
          imposter_word: null,
          imposter_player_id: null,
          live_sessions: 0,
          assignment_count: 0,
        },
      ],
    });
    await expect(getSnapshot(created.session)).rejects.toMatchObject({
      message: "room-closed",
    });
  });

  it("grants only hardened round entry points to the runtime role", async () => {
    const privileges = await ownerPool().query<{
      app_all: boolean;
      app_helper: boolean;
      public_any: boolean;
    }>(`
      with approved(signature) as (values
        ('private.get_online_recent_pair_ids(text,uuid,text,text)'),
        ('private.get_online_player_secret(text,uuid,text)'),
        ('private.start_online_round(text,uuid,text,text,integer,jsonb)'),
        ('private.mark_online_player_ready(text,uuid,text,integer)'),
        ('private.reveal_online_imposter(text,uuid,text,text,integer)'),
        ('private.reveal_online_civilian(text,uuid,text,text,integer)'),
        ('private.replay_online_room(text,uuid,text,text,integer)'),
        ('private.cancel_online_round(text,uuid,text,text,integer)'),
        ('private.close_online_room(text,uuid,text,text,integer)')
      )
      select
        bool_and(has_function_privilege('quickimposter_app', signature, 'EXECUTE'))
          as app_all,
        bool_or(has_function_privilege('public', signature, 'EXECUTE'))
          as public_any,
        has_function_privilege(
          'quickimposter_app',
          'private.lock_online_room_command(text,uuid,text,text,integer,boolean)',
          'EXECUTE'
        ) as app_helper
      from approved
    `);
    expect(privileges.rows).toEqual([
      { app_all: true, app_helper: false, public_any: false },
    ]);

    const functions = await ownerPool().query<{
      name: string;
      prosecdef: boolean;
      settings: string[];
    }>(`
      select procedure.proname as name,
             procedure.prosecdef,
             procedure.proconfig as settings
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'private'
        and procedure.proname in (
          'lock_online_room_command',
          'get_online_recent_pair_ids',
          'get_online_player_secret',
          'start_online_round',
          'mark_online_player_ready',
          'reveal_online_imposter',
          'reveal_online_civilian',
          'replay_online_room',
          'cancel_online_round',
          'close_online_room'
        )
      order by procedure.proname
    `);
    expect(functions.rows).toHaveLength(10);
    expect(functions.rows).toEqual(
      functions.rows.map((row) => ({
        ...row,
        prosecdef: true,
        settings: ["search_path=pg_catalog, private"],
      })),
    );
  });
});
