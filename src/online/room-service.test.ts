import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRoomService, RoomServiceError } from "@/online/room-service";
import { createRoomCapability } from "@/online/room-session";

const snapshot = {
  roomId: "A".repeat(22),
  phase: "lobby" as const,
  version: 0,
  category: "Food" as const,
  viewerPlayerId: "11111111-1111-4111-8111-111111111111",
  viewerIsHost: true,
  players: [],
  readyCount: 0,
  participantCount: 1,
  hostAwaySince: null,
  expiresAt: "2026-07-18T18:00:00.000Z",
  result: null,
};

function repositoryMock() {
  return {
    createRoom: vi.fn().mockResolvedValue(snapshot),
    joinRoom: vi.fn(),
    getSnapshot: vi.fn(),
    heartbeat: vi.fn(),
    checkRateLimit: vi.fn(),
    getRecentPairIds: vi.fn(),
    getSecret: vi.fn(),
    startRound: vi.fn(),
    runCommand: vi.fn(),
    cleanupStaleRooms: vi.fn(),
  };
}

describe("room service", () => {
  it("creates opaque identities and never sends raw capabilities to the repository", async () => {
    const repository = repositoryMock();
    const result = await createRoomService(repository).create({
      nickname: "  Maya  ",
      category: "Food",
    });

    expect(result.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(result.snapshot).toBe(snapshot);
    expect(JSON.stringify(repository.createRoom.mock.calls)).not.toContain(
      result.capability.parts.playerToken,
    );
    expect(JSON.stringify(repository.createRoom.mock.calls)).not.toContain(
      result.capability.parts.hostToken,
    );
    expect(repository.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        room: expect.objectContaining({ id: result.roomId }),
        player: expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          nickname: "Maya",
          normalizedNickname: "maya",
        }),
        session: expect.objectContaining({
          id: result.capability.parts.sessionId,
          playerTokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          hostTokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("normalizes a joining nickname and keeps the raw player token out of persistence", async () => {
    const repository = repositoryMock();
    repository.joinRoom.mockResolvedValue(snapshot);
    const result = await createRoomService(repository).join({
      roomId: snapshot.roomId,
      nickname: "  MÁYA  ",
    });

    expect(result.capability.parts.hostToken).toBeNull();
    expect(repository.joinRoom).toHaveBeenCalledWith(
      snapshot.roomId,
      expect.objectContaining({
        player: expect.objectContaining({ nickname: "MÁYA", normalizedNickname: "máya" }),
        session: expect.objectContaining({
          playerTokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          hostTokenDigest: null,
        }),
      }),
    );
    expect(JSON.stringify(repository.joinRoom.mock.calls)).not.toContain(
      result.capability.parts.playerToken,
    );
  });

  it("forwards an unchanged snapshot marker with only a capability digest", async () => {
    const repository = repositoryMock();
    const unchanged = { changed: false as const, version: 7 };
    repository.getSnapshot.mockResolvedValue(unchanged);
    const capability = createRoomCapability(false).parts;

    await expect(
      createRoomService(repository).snapshot({
        roomId: snapshot.roomId,
        capability,
        knownVersion: 7,
      }),
    ).resolves.toBe(unchanged);
    expect(repository.getSnapshot).toHaveBeenCalledWith(
      snapshot.roomId,
      capability.sessionId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      7,
    );
    expect(JSON.stringify(repository.getSnapshot.mock.calls)).not.toContain(
      capability.playerToken,
    );
  });

  it("fetches only the acting player's personal secret", async () => {
    const repository = repositoryMock();
    repository.getSecret.mockResolvedValue({ word: "Apple" });
    const capability = createRoomCapability(false).parts;

    await expect(
      createRoomService(repository).secret({ roomId: snapshot.roomId, capability }),
    ).resolves.toEqual({ word: "Apple" });
    expect(repository.getSecret).toHaveBeenCalledWith(
      snapshot.roomId,
      capability.sessionId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(JSON.stringify(repository.getSecret.mock.calls)).not.toContain(
      capability.playerToken,
    );
  });

  it("starts with a system pair outside the room's recent 30 selections", async () => {
    const repository = repositoryMock();
    repository.getRecentPairIds.mockResolvedValue({
      category: "Food",
      recentPairIds: [
        "food-apple-orange",
        "food-coffee-tea",
        "food-pizza-burger",
        "food-lemon-lime",
      ],
    });
    repository.startRound.mockResolvedValue({ ok: true, version: 4 });
    const capability = createRoomCapability(true).parts;

    await expect(
      createRoomService(repository, { random: () => 0 }).command({
        roomId: snapshot.roomId,
        capability,
        command: { type: "start", expectedVersion: 3 },
      }),
    ).resolves.toEqual({ ok: true, version: 4 });
    expect(repository.getRecentPairIds).toHaveBeenCalledWith(
      snapshot.roomId,
      capability.sessionId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(repository.startRound).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: snapshot.roomId,
        expectedVersion: 3,
        round: expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          wordPairId: "food-pancake-waffle",
          civilianWord: "Pancake",
          imposterWord: "Waffle",
        }),
      }),
    );
    expect(
      JSON.stringify([
        repository.getRecentPairIds.mock.calls,
        repository.startRound.mock.calls,
      ]),
    ).not.toContain(capability.playerToken);
    expect(
      JSON.stringify([
        repository.getRecentPairIds.mock.calls,
        repository.startRound.mock.calls,
      ]),
    ).not.toContain(capability.hostToken);
  });

  it("falls back to the least-recent category pair when every pair is recent", async () => {
    const repository = repositoryMock();
    repository.getRecentPairIds.mockResolvedValue({
      category: "Food",
      recentPairIds: [
        "food-pizza-burger",
        "food-lemon-lime",
        "food-coffee-tea",
        "food-pancake-waffle",
        "food-apple-orange",
      ],
    });
    repository.startRound.mockResolvedValue({ ok: true, version: 2 });

    await createRoomService(repository).command({
      roomId: snapshot.roomId,
      capability: createRoomCapability(true).parts,
      command: { type: "start", expectedVersion: 1 },
    });

    expect(repository.startRound).toHaveBeenCalledWith(
      expect.objectContaining({
        round: expect.objectContaining({ wordPairId: "food-apple-orange" }),
      }),
    );
  });

  it("selects a concrete system pair for an All Categories room", async () => {
    const repository = repositoryMock();
    repository.getRecentPairIds.mockResolvedValue({
      category: "All Categories",
      recentPairIds: [],
    });
    repository.startRound.mockResolvedValue({ ok: true, version: 2 });

    await createRoomService(repository, { random: () => 0 }).command({
      roomId: snapshot.roomId,
      capability: createRoomCapability(true).parts,
      command: { type: "start", expectedVersion: 1 },
    });

    expect(repository.startRound).toHaveBeenCalledWith(
      expect.objectContaining({
        round: expect.objectContaining({
          wordPairId: "food-apple-orange",
          category: "Food",
        }),
      }),
    );
  });

  it("maps an invalid authoritative category to unavailable", async () => {
    const repository = repositoryMock();
    repository.getRecentPairIds.mockResolvedValue({
      category: "Unexpected Category",
      recentPairIds: [],
    });

    await expect(
      createRoomService(repository).command({
        roomId: snapshot.roomId,
        capability: createRoomCapability(true).parts,
        command: { type: "start", expectedVersion: 1 },
      }),
    ).rejects.toMatchObject({
      name: "RoomServiceError",
      code: "unavailable",
      message: "Online room request failed",
    });
  });

  it("allows a player capability to submit ready without a host token", async () => {
    const repository = repositoryMock();
    repository.runCommand.mockResolvedValue({ ok: true, version: 5 });
    const capability = createRoomCapability(false).parts;

    await expect(
      createRoomService(repository).command({
        roomId: snapshot.roomId,
        capability,
        command: { type: "ready", expectedVersion: 4 },
      }),
    ).resolves.toEqual({ ok: true, version: 5 });
    expect(repository.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: snapshot.roomId,
        sessionId: capability.sessionId,
        playerDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        hostDigest: null,
        command: { type: "ready", expectedVersion: 4 },
      }),
    );
  });

  it("maps only stable database failures without exposing database text", async () => {
    const repository = repositoryMock();
    repository.createRoom.mockRejectedValue(
      Object.assign(new Error("nickname-taken"), {
        code: "P0001",
        detail: "private.players normalized_nickname leaked detail",
      }),
    );

    const request = createRoomService(repository).create({
      nickname: "Maya",
      category: "Food",
    });
    await expect(request).rejects.toEqual(
      expect.objectContaining<Partial<RoomServiceError>>({
        name: "RoomServiceError",
        code: "nickname-taken",
        message: "Online room request failed",
      }),
    );
    await expect(request).rejects.not.toHaveProperty("detail");
  });

  it("hashes heartbeat capability before forwarding it", async () => {
    const repository = repositoryMock();
    repository.heartbeat.mockResolvedValue({ ok: true });
    const capability = createRoomCapability(false).parts;

    await expect(
      createRoomService(repository).heartbeat({ roomId: snapshot.roomId, capability }),
    ).resolves.toEqual({ ok: true });
    expect(repository.heartbeat).toHaveBeenCalledWith(
      snapshot.roomId,
      capability.sessionId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(JSON.stringify(repository.heartbeat.mock.calls)).not.toContain(
      capability.playerToken,
    );
  });

  it("turns a denied fixed-window check into a safe rate-limited error", async () => {
    const repository = repositoryMock();
    repository.checkRateLimit.mockResolvedValue(false);

    await expect(
      createRoomService(repository).checkRateLimit({
        keyDigest: "c".repeat(64),
        action: "join",
        limit: 30,
        windowSeconds: 600,
      }),
    ).rejects.toMatchObject({ code: "rate-limited" });
  });

  it("rejects host commands before persistence when the host capability is absent", async () => {
    const repository = repositoryMock();
    await expect(
      createRoomService(repository).command({
        roomId: snapshot.roomId,
        capability: createRoomCapability(false).parts,
        command: { type: "reveal-imposter", expectedVersion: 4 },
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
    expect(repository.runCommand).not.toHaveBeenCalled();
  });

  it("forwards the bounded cleanup count", async () => {
    const repository = repositoryMock();
    repository.cleanupStaleRooms.mockResolvedValue(3);
    await expect(createRoomService(repository).cleanupStaleRooms()).resolves.toBe(3);
  });

  it("maps unknown persistence failures to unavailable", async () => {
    const repository = repositoryMock();
    repository.heartbeat.mockRejectedValue(new Error("connection detail"));
    await expect(
      createRoomService(repository).heartbeat({
        roomId: snapshot.roomId,
        capability: createRoomCapability(false).parts,
      }),
    ).rejects.toMatchObject({
      code: "unavailable",
      message: "Online room request failed",
    });
  });
});
