import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { Category } from "@/game/game-reducer";
import { selectWordPair } from "@/game/word-repository";
import { WORD_PAIRS } from "@/game/word-pairs";
import {
  RepositoryError,
  type RoomRepository,
} from "@/online/room-repository";
import {
  createRoomCapability,
  digestToken,
  type CapabilityParts,
} from "@/online/room-session";
import { normalizeNickname } from "@/online/room-validation";
import type { ApiErrorCode, RoomCommand } from "@/online/room-types";

export class RoomServiceError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super("Online room request failed");
    this.name = "RoomServiceError";
  }
}

type ServiceOptions = {
  random?: () => number;
};

const DATABASE_ERROR_CODES = new Set<ApiErrorCode>([
  "invalid-request",
  "not-found",
  "room-full",
  "nickname-taken",
  "unauthorized",
  "conflict",
  "room-closed",
  "rate-limited",
  "unavailable",
]);

async function serviceCall<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RoomServiceError) throw error;
    if (error instanceof RepositoryError) {
      throw new RoomServiceError("unavailable");
    }
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "P0001" &&
      DATABASE_ERROR_CODES.has(error.message as ApiErrorCode)
    ) {
      throw new RoomServiceError(error.message as ApiErrorCode);
    }
    throw new RoomServiceError("unavailable");
  }
}

export function createRoomService(
  repository: RoomRepository,
  options: ServiceOptions = {},
) {
  return {
    async create(input: { nickname: string; category: Category }) {
      const roomId = randomBytes(16).toString("base64url");
      const playerId = randomUUID();
      const nickname = input.nickname.trim();
      const capability = createRoomCapability(true);
      const playerTokenDigest = await digestToken(capability.parts.playerToken);
      const hostTokenDigest = await digestToken(capability.parts.hostToken!);
      const snapshot = await serviceCall(() => repository.createRoom({
        room: { id: roomId, category: input.category },
        player: {
          id: playerId,
          nickname,
          normalizedNickname: normalizeNickname(nickname),
        },
        session: {
          id: capability.parts.sessionId,
          playerId,
          playerTokenDigest,
          hostTokenDigest,
        },
      }));

      return { roomId, capability, snapshot };
    },

    async join(input: { roomId: string; nickname: string }) {
      const nickname = input.nickname.trim();
      const playerId = randomUUID();
      const capability = createRoomCapability(false);
      const playerTokenDigest = await digestToken(capability.parts.playerToken);
      const snapshot = await serviceCall(() => repository.joinRoom(input.roomId, {
        player: {
          id: playerId,
          nickname,
          normalizedNickname: normalizeNickname(nickname),
        },
        session: {
          id: capability.parts.sessionId,
          playerId,
          playerTokenDigest,
          hostTokenDigest: null,
        },
      }));

      return { roomId: input.roomId, capability, snapshot };
    },

    async snapshot(input: {
      roomId: string;
      capability: CapabilityParts | null;
      knownVersion: number | null;
    }) {
      const playerDigest = input.capability
        ? await digestToken(input.capability.playerToken)
        : null;
      return serviceCall(() => repository.getSnapshot(
        input.roomId,
        input.capability?.sessionId ?? null,
        playerDigest,
        input.knownVersion,
      ));
    },

    async secret(input: { roomId: string; capability: CapabilityParts }) {
      const playerDigest = await digestToken(input.capability.playerToken);
      return serviceCall(() => repository.getSecret(
        input.roomId,
        input.capability.sessionId,
        playerDigest,
      ));
    },

    async command(input: {
      roomId: string;
      capability: CapabilityParts;
      command: RoomCommand;
    }) {
      const command = input.command;
      const requiresHost = command.type !== "ready";
      if (requiresHost && !input.capability.hostToken) {
        throw new RoomServiceError("unauthorized");
      }

      const playerDigest = await digestToken(input.capability.playerToken);
      const hostDigest = input.capability.hostToken
        ? await digestToken(input.capability.hostToken)
        : null;

      if (command.type !== "start") {
        return serviceCall(() => repository.runCommand({
          roomId: input.roomId,
          sessionId: input.capability.sessionId,
          playerDigest,
          hostDigest,
          command,
        }));
      }

      const startContext = await serviceCall(() =>
        repository.getRecentPairIds(
          input.roomId,
          input.capability.sessionId,
          playerDigest,
          hostDigest!,
        ),
      );
      const wordPair = await serviceCall(async () =>
        selectWordPair(
          WORD_PAIRS,
          startContext.category,
          startContext.recentPairIds,
          options.random,
        ),
      );
      return serviceCall(() => repository.startRound({
        roomId: input.roomId,
        sessionId: input.capability.sessionId,
        playerDigest,
        hostDigest: hostDigest!,
        expectedVersion: command.expectedVersion,
        round: {
          id: randomUUID(),
          wordPairId: wordPair.id,
          category: wordPair.category,
          civilianWord: wordPair.civilian,
          imposterWord: wordPair.imposter,
        },
      }));
    },

    async heartbeat(input: { roomId: string; capability: CapabilityParts }) {
      const playerDigest = await digestToken(input.capability.playerToken);
      return serviceCall(() =>
        repository.heartbeat(
          input.roomId,
          input.capability.sessionId,
          playerDigest,
        ),
      );
    },

    async checkRateLimit(input: {
      keyDigest: string;
      action: string;
      limit: number;
      windowSeconds: number;
    }) {
      const allowed = await serviceCall(() =>
        repository.checkRateLimit(
          input.keyDigest,
          input.action,
          input.limit,
          input.windowSeconds,
        ),
      );
      if (!allowed) throw new RoomServiceError("rate-limited");
    },

    cleanupStaleRooms() {
      return serviceCall(() => repository.cleanupStaleRooms());
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
