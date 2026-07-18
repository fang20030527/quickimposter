import "server-only";

import type { Pool } from "pg";

import { getDatabasePool } from "@/online/neon-pool";
import type { RoomSnapshot } from "@/online/room-types";
import type { Category } from "@/game/game-reducer";

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
  };
}

export type RoomRepository = ReturnType<typeof createRoomRepository>;
