import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDatabasePool } = vi.hoisted(() => ({ getDatabasePool: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/online/neon-pool", () => ({ getDatabasePool }));

import { createRoomRepository, RepositoryError } from "@/online/room-repository";

const snapshot = {
  roomId: "A".repeat(22),
  phase: "lobby" as const,
  version: 0,
  category: "Food" as const,
  viewerPlayerId: "player-id",
  viewerIsHost: true,
  players: [],
  readyCount: 0,
  participantCount: 1,
  hostAwaySince: null,
  expiresAt: "2026-07-18T18:00:00.000Z",
  result: null,
};

const room = { id: snapshot.roomId, category: "Food" as const };
const player = {
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "Maya",
  normalizedNickname: "maya",
};
const session = {
  id: "22222222-2222-4222-8222-222222222222",
  playerId: player.id,
  playerTokenDigest: "a".repeat(64),
  hostTokenDigest: "b".repeat(64),
};

describe("room repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a room with one parameterized database function call", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: snapshot }] });
    const repository = createRoomRepository({ query } as never);

    await expect(repository.createRoom({ room, player, session })).resolves.toBe(snapshot);
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/select private\.create_online_room\(\$1::jsonb, \$2::jsonb, \$3::jsonb\) as result/i),
      [room, player, session],
    );
  });

  it("joins with a stable room, player, session argument order", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: snapshot }] });
    const repository = createRoomRepository({ query } as never);
    await repository.joinRoom(snapshot.roomId, { player, session });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("private.join_online_room"),
      [snapshot.roomId, player, session],
    );
  });

  it("passes nullable identity and the known version to snapshot", async () => {
    const unchanged = { changed: false as const, version: 4 };
    const query = vi.fn().mockResolvedValue({ rows: [{ result: unchanged }] });
    const repository = createRoomRepository({ query } as never);
    await expect(
      repository.getSnapshot(snapshot.roomId, null, null, 4),
    ).resolves.toBe(unchanged);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("private.get_online_room_snapshot"),
      [snapshot.roomId, null, null, 4],
    );
  });

  it("forwards heartbeat capability digests in stable order", async () => {
    const heartbeat = { ok: true as const };
    const query = vi.fn().mockResolvedValue({ rows: [{ result: heartbeat }] });
    const repository = createRoomRepository({ query } as never);
    await expect(
      repository.heartbeat(snapshot.roomId, session.id, session.playerTokenDigest),
    ).resolves.toBe(heartbeat);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("private.heartbeat_online_room"),
      [snapshot.roomId, session.id, session.playerTokenDigest],
    );
  });

  it("unwraps the fixed-window rate-limit boolean", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: false }] });
    const repository = createRoomRepository({ query } as never);
    await expect(
      repository.checkRateLimit("c".repeat(64), "join", 5, 60),
    ).resolves.toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("private.check_online_rate_limit"),
      ["c".repeat(64), "join", 5, 60],
    );
  });

  it("uses the lazy application pool when none is injected", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: snapshot }] });
    getDatabasePool.mockReturnValue({ query });
    await createRoomRepository().createRoom({ room, player, session });
    expect(getDatabasePool).toHaveBeenCalledOnce();
  });

  it("reports unavailable when a function does not return exactly one result", async () => {
    const repository = createRoomRepository({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as never);
    await expect(repository.createRoom({ room, player, session })).rejects.toEqual(
      expect.objectContaining<Partial<RepositoryError>>({
        name: "RepositoryError",
        code: "unavailable",
      }),
    );
  });

  it("preserves PostgreSQL errors for the service mapping boundary", async () => {
    const postgresError = Object.assign(new Error("room-full"), { code: "P0001" });
    const repository = createRoomRepository({
      query: vi.fn().mockRejectedValue(postgresError),
    } as never);
    await expect(repository.joinRoom(snapshot.roomId, { player, session })).rejects.toBe(
      postgresError,
    );
  });
});
