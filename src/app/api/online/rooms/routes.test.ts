import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { service, readRoomCapability, writeRoomCapability } = vi.hoisted(() => ({
  service: {
    checkRateLimit: vi.fn(),
    command: vi.fn(),
    create: vi.fn(),
    heartbeat: vi.fn(),
    join: vi.fn(),
    secret: vi.fn(),
    snapshot: vi.fn(),
  },
  readRoomCapability: vi.fn(),
  writeRoomCapability: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/online/room-service-provider", () => ({
  getRoomService: () => service,
}));
vi.mock("@/online/room-cookies", () => ({
  readRoomCapability,
  writeRoomCapability,
}));

import { POST as createRoom } from "./route";
import { GET as getSnapshot } from "./[roomId]/route";
import { POST as joinRoom } from "./[roomId]/join/route";
import { GET as getSecret } from "./[roomId]/secret/route";
import { POST as sendCommand } from "./[roomId]/commands/route";
import { POST as heartbeat } from "./[roomId]/heartbeat/route";
import { RoomServiceError } from "@/online/room-service";

const roomId = "A".repeat(22);
const snapshot = {
  roomId,
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
const capability = {
  value: "capability-cookie-value",
  parts: {
    sessionId: "22222222-2222-4222-8222-222222222222",
    playerToken: "p".repeat(43),
    hostToken: "h".repeat(43),
  },
};

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.4",
    },
    body: JSON.stringify(body),
  });
}

describe("online room route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ROOM_RATE_LIMIT_SECRET", "route-test-rate-secret");
    service.checkRateLimit.mockResolvedValue(undefined);
    readRoomCapability.mockResolvedValue(capability.parts);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a room, rate limits by opaque IP identity, and writes its capability", async () => {
    service.create.mockResolvedValue({ roomId, capability, snapshot });

    const response = await createRoom(jsonRequest(
      "https://example.test/api/online/rooms",
      { nickname: "Maya", category: "Food" },
    ));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual(snapshot);
    expect(service.checkRateLimit).toHaveBeenCalledWith({
      keyDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      action: "create",
      limit: 10,
      windowSeconds: 600,
    });
    expect(service.create).toHaveBeenCalledWith({
      nickname: "Maya",
      category: "Food",
    });
    expect(writeRoomCapability).toHaveBeenCalledWith(roomId, capability.value);
  });

  it("joins through awaited params and writes the new player capability", async () => {
    service.join.mockResolvedValue({ roomId, capability, snapshot });

    const response = await joinRoom(
      jsonRequest(
        `https://example.test/api/online/rooms/${roomId}/join`,
        { nickname: "Noah" },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual(snapshot);
    expect(service.checkRateLimit).toHaveBeenCalledWith({
      keyDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      action: "join",
      limit: 30,
      windowSeconds: 600,
    });
    expect(service.join).toHaveBeenCalledWith({ roomId, nickname: "Noah" });
    expect(writeRoomCapability).toHaveBeenCalledWith(roomId, capability.value);
  });

  it("returns a changed authenticated snapshot with the session limit", async () => {
    service.snapshot.mockResolvedValue({ changed: true, snapshot });

    const response = await getSnapshot(
      new Request(
        `https://example.test/api/online/rooms/${roomId}?version=0`,
        { headers: { "x-forwarded-for": "203.0.113.4" } },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual(snapshot);
    expect(service.checkRateLimit).toHaveBeenCalledWith({
      keyDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      action: "snapshot-session",
      limit: 420,
      windowSeconds: 300,
    });
    expect(service.snapshot).toHaveBeenCalledWith({
      roomId,
      capability: capability.parts,
      knownVersion: 0,
    });
  });

  it("returns an empty 204 for an unchanged guest snapshot", async () => {
    readRoomCapability.mockResolvedValue(null);
    service.snapshot.mockResolvedValue({ changed: false, version: 3 });

    const response = await getSnapshot(
      new Request(
        `https://example.test/api/online/rooms/${roomId}?version=3`,
        { headers: { "x-forwarded-for": "203.0.113.4" } },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.text()).resolves.toBe("");
    expect(service.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "snapshot-guest",
        limit: 90,
        windowSeconds: 300,
      }),
    );
    expect(service.snapshot).toHaveBeenCalledWith({
      roomId,
      capability: null,
      knownVersion: 3,
    });
  });

  it("passes a missing snapshot version as null", async () => {
    service.snapshot.mockResolvedValue({ changed: true, snapshot });

    const response = await getSnapshot(
      new Request(`https://example.test/api/online/rooms/${roomId}`),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    expect(service.snapshot).toHaveBeenCalledWith(expect.objectContaining({
      knownVersion: null,
    }));
  });

  it.each([
    `https://example.test/api/online/rooms/${roomId}?version=-1`,
    `https://example.test/api/online/rooms/${roomId}?version=1.5`,
    `https://example.test/api/online/rooms/${roomId}?version=1&version=2`,
    `https://example.test/api/online/rooms/${roomId}?version=1&token=secret`,
  ])("rejects an invalid snapshot query %s", async (url) => {
    const response = await getSnapshot(
      new Request(url),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(400);
    expect(service.snapshot).not.toHaveBeenCalled();
  });

  it("returns only the authenticated player's word", async () => {
    service.secret.mockResolvedValue({ word: "Apple" });

    const response = await getSecret(
      new Request(`https://example.test/api/online/rooms/${roomId}/secret`),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ word: "Apple" });
    expect(service.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "secret",
        limit: 60,
        windowSeconds: 300,
      }),
    );
    expect(service.secret).toHaveBeenCalledWith({
      roomId,
      capability: capability.parts,
    });
  });

  it("runs an authenticated versioned command with the session limit", async () => {
    service.command.mockResolvedValue({ ok: true, version: 4 });

    const response = await sendCommand(
      jsonRequest(
        `https://example.test/api/online/rooms/${roomId}/commands`,
        { type: "ready", expectedVersion: 3 },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, version: 4 });
    expect(service.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "command",
        limit: 120,
        windowSeconds: 300,
      }),
    );
    expect(service.command).toHaveBeenCalledWith({
      roomId,
      capability: capability.parts,
      command: { type: "ready", expectedVersion: 3 },
    });
  });

  it("records an authenticated heartbeat with the confirmed session limit", async () => {
    service.heartbeat.mockResolvedValue({ ok: true });

    const response = await heartbeat(
      new Request(
        `https://example.test/api/online/rooms/${roomId}/heartbeat`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(service.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "heartbeat",
        limit: 30,
        windowSeconds: 300,
      }),
    );
    expect(service.heartbeat).toHaveBeenCalledWith({
      roomId,
      capability: capability.parts,
    });
  });

  it("rejects an oversized heartbeat body before mutation", async () => {
    service.heartbeat.mockResolvedValue({ ok: true });

    const response = await heartbeat(
      new Request(
        `https://example.test/api/online/rooms/${roomId}/heartbeat`,
        { method: "POST", body: " ".repeat(4_097) },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(400);
    expect(service.heartbeat).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without calling room creation", async () => {
    const response = await createRoom(new Request(
      "https://example.test/api/online/rooms",
      {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.4" },
        body: "{",
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid-request" });
    expect(service.create).not.toHaveBeenCalled();
    expect(writeRoomCapability).not.toHaveBeenCalled();
  });

  it("rejects a syntactically valid JSON body above four KiB", async () => {
    const body = JSON.stringify({ nickname: "Maya", category: "Food" })
      + " ".repeat(4_097);
    const response = await createRoom(new Request(
      "https://example.test/api/online/rooms",
      {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.4" },
        body,
      },
    ));

    expect(response.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid room ID before room access", async () => {
    const response = await joinRoom(
      jsonRequest("https://example.test/api/online/rooms/bad/join", {
        nickname: "Noah",
      }),
      { params: Promise.resolve({ roomId: "bad" }) },
    );

    expect(response.status).toBe(400);
    expect(service.join).not.toHaveBeenCalled();
    expect(service.checkRateLimit).not.toHaveBeenCalled();
  });

  it("rejects secret access without a room capability", async () => {
    readRoomCapability.mockResolvedValue(null);

    const response = await getSecret(
      new Request(`https://example.test/api/online/rooms/${roomId}/secret`),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(service.secret).not.toHaveBeenCalled();
  });

  it.each([
    ["not-found", 404],
    ["room-full", 409],
    ["nickname-taken", 409],
    ["room-closed", 410],
    ["rate-limited", 429],
    ["unavailable", 503],
  ] as const)("maps %s to a stable %i response", async (code, status) => {
    service.join.mockRejectedValue(new RoomServiceError(code));

    const response = await joinRoom(
      jsonRequest(
        `https://example.test/api/online/rooms/${roomId}/join`,
        { nickname: "Noah" },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code });
    expect(writeRoomCapability).not.toHaveBeenCalled();
  });

  it("maps a stale command to conflict without leaking service details", async () => {
    service.command.mockRejectedValue(new RoomServiceError("conflict"));

    const response = await sendCommand(
      jsonRequest(
        `https://example.test/api/online/rooms/${roomId}/commands`,
        { type: "ready", expectedVersion: 2 },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "conflict" });
  });

  it("maps unknown failures to unavailable without returning their text", async () => {
    service.heartbeat.mockRejectedValue(new Error("database password leaked"));

    const response = await heartbeat(
      new Request(
        `https://example.test/api/online/rooms/${roomId}/heartbeat`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "unavailable" });
    expect(text).not.toContain("database password leaked");
  });

  it("refuses a snapshot carrying database-only fields", async () => {
    service.snapshot.mockResolvedValue({
      changed: true,
      snapshot: { ...snapshot, civilianWord: "Apple" },
    });

    const response = await getSnapshot(
      new Request(`https://example.test/api/online/rooms/${roomId}`),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "unavailable" });
  });
});
