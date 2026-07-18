import { describe, expect, it } from "vitest";
import {
  commandSchema,
  nicknameSchema,
  normalizeNickname,
  roomSnapshotSchema,
} from "./room-validation";

const snapshot = {
  roomId: "A".repeat(22),
  phase: "lobby" as const,
  version: 0,
  category: "Food" as const,
  viewerPlayerId: "11111111-1111-4111-8111-111111111111",
  viewerIsHost: true,
  players: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      nickname: "Maya",
      state: "active" as const,
      isHost: true,
      isReady: false,
    },
  ],
  readyCount: 0,
  participantCount: 1,
  hostAwaySince: null,
  expiresAt: "2026-07-18T18:00:00.000Z",
  result: null,
};

describe("online room validation", () => {
  it("trims and normalizes a valid nickname", () => {
    expect(nicknameSchema.parse("  Maya  ")).toBe("Maya");
    expect(normalizeNickname("MÁYA")).toBe("máya");
  });

  it.each(["", "a", " ".repeat(4), "x".repeat(21)])(
    "rejects nickname %j",
    (value) => {
      expect(() => nicknameSchema.parse(value)).toThrow();
    },
  );

  it("rejects nicknames containing invisible control characters", () => {
    expect(() => nicknameSchema.parse("Ma\u0000ya")).toThrow();
  });

  it("accepts only declared room commands", () => {
    expect(commandSchema.parse({ type: "ready", expectedVersion: 3 })).toEqual({
      type: "ready",
      expectedVersion: 3,
    });
    expect(() =>
      commandSchema.parse({ type: "skip-reveal", expectedVersion: 3 }),
    ).toThrow();
  });

  it.each([
    "lobby",
    "private-reveal",
    "discussion",
    "imposter-revealed",
    "civilian-revealed",
    "closed",
  ] as const)("accepts a safe %s room snapshot", (phase) => {
    expect(roomSnapshotSchema.parse({ ...snapshot, phase })).toEqual({
      ...snapshot,
      phase,
    });
  });

  it("accepts anonymous viewers and nullable staged result fields", () => {
    expect(roomSnapshotSchema.parse({
      ...snapshot,
      viewerPlayerId: null,
      viewerIsHost: false,
      phase: "imposter-revealed",
      result: {
        imposterNickname: "Maya",
        imposterWord: "Orange",
        civilianWord: null,
      },
    }).result).toEqual({
      imposterNickname: "Maya",
      imposterWord: "Orange",
      civilianWord: null,
    });
  });

  it("accepts PostgreSQL timestamp offsets", () => {
    expect(roomSnapshotSchema.parse({
      ...snapshot,
      hostAwaySince: "2026-07-18T17:59:00+00:00",
      expiresAt: "2026-07-18T18:00:00+00:00",
    })).toEqual(expect.objectContaining({
      hostAwaySince: "2026-07-18T17:59:00+00:00",
      expiresAt: "2026-07-18T18:00:00+00:00",
    }));
  });

  it("rejects missing fields and secret-bearing extras at every level", () => {
    const missingVersion: Partial<typeof snapshot> = { ...snapshot };
    delete missingVersion.version;
    expect(() => roomSnapshotSchema.parse(missingVersion)).toThrow();
    expect(() => roomSnapshotSchema.parse({
      ...snapshot,
      civilianWord: "Apple",
    })).toThrow();
    expect(() => roomSnapshotSchema.parse({
      ...snapshot,
      players: [{ ...snapshot.players[0], playerToken: "secret" }],
    })).toThrow();
    expect(() => roomSnapshotSchema.parse({
      ...snapshot,
      phase: "civilian-revealed",
      result: {
        imposterNickname: "Maya",
        imposterWord: "Orange",
        civilianWord: "Apple",
        imposterPlayerId: snapshot.players[0].id,
      },
    })).toThrow();
  });
});
