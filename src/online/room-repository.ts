import "server-only";

import type { Pool } from "pg";

import type { Category } from "@/game/game-reducer";
import { getDatabasePool } from "@/online/neon-pool";
import type { RoomCommand, RoomSnapshot } from "@/online/room-types";

export type RoomRecordInput = {
  id: string;
  category: Category;
};

export type PlayerRecordInput = {
  id: string;
  nickname: string;
  normalizedNickname: string;
};

export type SessionRecordInput = {
  id: string;
  playerId: string;
  playerTokenDigest: string;
  hostTokenDigest: string | null;
};

export type CreateRoomPersistenceInput = {
  room: RoomRecordInput;
  player: PlayerRecordInput;
  session: SessionRecordInput;
};

export type JoinRoomPersistenceInput = {
  player: PlayerRecordInput;
  session: SessionRecordInput;
};

export type SnapshotResult =
  | { changed: false; version: number }
  | { changed: true; snapshot: RoomSnapshot };

export type StartContext = {
  category: Category;
  recentPairIds: string[];
};

export type CommandResult = { ok: true; version: number };

export type StartRoundPersistenceInput = {
  roomId: string;
  sessionId: string;
  playerDigest: string;
  hostDigest: string;
  expectedVersion: number;
  round: {
    id: string;
    wordPairId: string;
    category: Category;
    civilianWord: string;
    imposterWord: string;
  };
};

type PersistedRoomCommand = Exclude<RoomCommand, { type: "start" }>;

export type RunCommandPersistenceInput = {
  roomId: string;
  sessionId: string;
  playerDigest: string;
  hostDigest: string | null;
  command: PersistedRoomCommand;
};

const HOST_COMMAND_FUNCTIONS = {
  "reveal-imposter": "reveal_online_imposter",
  "reveal-civilian": "reveal_online_civilian",
  "play-again": "replay_online_room",
  "cancel-round": "cancel_online_round",
  "close-room": "close_online_room",
} as const;

export class RepositoryError extends Error {
  readonly code = "unavailable" as const;

  constructor() {
    super("Database function returned an invalid result");
    this.name = "RepositoryError";
  }
}

type Database = Pick<Pool, "query">;

async function callFunction<T>(
  database: Database,
  statement: string,
  values: unknown[],
): Promise<T> {
  const queryResult = await database.query(statement, values);
  if (queryResult.rows.length !== 1 || queryResult.rows[0]?.result == null) {
    throw new RepositoryError();
  }
  return queryResult.rows[0].result as T;
}

export function createRoomRepository(database: Database = getDatabasePool()) {
  return {
    createRoom(input: CreateRoomPersistenceInput) {
      return callFunction<RoomSnapshot>(
        database,
        "select private.create_online_room($1::jsonb, $2::jsonb, $3::jsonb) as result",
        [input.room, input.player, input.session],
      );
    },

    joinRoom(roomId: string, input: JoinRoomPersistenceInput) {
      return callFunction<RoomSnapshot>(
        database,
        "select private.join_online_room($1::text, $2::jsonb, $3::jsonb) as result",
        [roomId, input.player, input.session],
      );
    },

    getSnapshot(
      roomId: string,
      sessionId: string | null,
      playerDigest: string | null,
      knownVersion: number | null,
    ) {
      return callFunction<SnapshotResult>(
        database,
        "select private.get_online_room_snapshot($1::text, $2::uuid, $3::text, $4::integer) as result",
        [roomId, sessionId, playerDigest, knownVersion],
      );
    },

    heartbeat(roomId: string, sessionId: string, playerDigest: string) {
      return callFunction<{ ok: true }>(
        database,
        "select private.heartbeat_online_room($1::text, $2::uuid, $3::text) as result",
        [roomId, sessionId, playerDigest],
      );
    },

    checkRateLimit(
      keyDigest: string,
      action: string,
      limit: number,
      windowSeconds: number,
    ) {
      return callFunction<boolean>(
        database,
        "select private.check_online_rate_limit($1::text, $2::text, $3::integer, $4::integer) as result",
        [keyDigest, action, limit, windowSeconds],
      );
    },

    getRecentPairIds(
      roomId: string,
      sessionId: string,
      playerDigest: string,
      hostDigest: string,
    ) {
      return callFunction<StartContext>(
        database,
        "select private.get_online_recent_pair_ids($1::text, $2::uuid, $3::text, $4::text) as result",
        [roomId, sessionId, playerDigest, hostDigest],
      );
    },

    getSecret(roomId: string, sessionId: string, playerDigest: string) {
      return callFunction<{ word: string }>(
        database,
        "select private.get_online_player_secret($1::text, $2::uuid, $3::text) as result",
        [roomId, sessionId, playerDigest],
      );
    },

    startRound(input: StartRoundPersistenceInput) {
      return callFunction<CommandResult>(
        database,
        "select private.start_online_round($1::text, $2::uuid, $3::text, $4::text, $5::integer, $6::jsonb) as result",
        [
          input.roomId,
          input.sessionId,
          input.playerDigest,
          input.hostDigest,
          input.expectedVersion,
          input.round,
        ],
      );
    },

    runCommand(input: RunCommandPersistenceInput) {
      if (input.command.type === "ready") {
        return callFunction<CommandResult>(
          database,
          "select private.mark_online_player_ready($1::text, $2::uuid, $3::text, $4::integer) as result",
          [
            input.roomId,
            input.sessionId,
            input.playerDigest,
            input.command.expectedVersion,
          ],
        );
      }

      const functionName = HOST_COMMAND_FUNCTIONS[input.command.type];
      return callFunction<CommandResult>(
        database,
        `select private.${functionName}($1::text, $2::uuid, $3::text, $4::text, $5::integer) as result`,
        [
          input.roomId,
          input.sessionId,
          input.playerDigest,
          input.hostDigest,
          input.command.expectedVersion,
        ],
      );
    },

    cleanupStaleRooms() {
      return callFunction<number>(
        database,
        "select private.cleanup_online_rooms() as result",
        [],
      );
    },
  };
}

export type RoomRepository = ReturnType<typeof createRoomRepository>;
