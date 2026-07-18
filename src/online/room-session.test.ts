import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, cookieStore } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  cookieStore: {
    delete: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import {
  createRoomCapability,
  digestToken,
  equalDigest,
  parseRoomCapability,
} from "./room-session";
import {
  clearRoomCapability,
  readRoomCapability,
  writeRoomCapability,
} from "./room-cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("room capability", () => {
  it("round-trips a player and host capability", async () => {
    const capability = createRoomCapability(true);

    expect(parseRoomCapability(capability.value)).toEqual(capability.parts);
    expect(await digestToken(capability.parts.playerToken)).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(capability.parts.hostToken).toHaveLength(43);
  });

  it("rejects malformed cookie values", () => {
    expect(parseRoomCapability("not-a-capability")).toBeNull();

    const { parts } = createRoomCapability(false);
    expect(parseRoomCapability(`${"-".repeat(36)}.${parts.playerToken}.`)).toBeNull();
  });

  it("compares only valid token digests", async () => {
    const first = await digestToken("first-token");
    const second = await digestToken("second-token");

    expect(equalDigest(first, first)).toBe(true);
    expect(equalDigest(first, second)).toBe(false);
    expect(equalDigest("not-hex", "not-hex")).toBe(false);
  });
});

describe("room capability cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue(cookieStore);
  });

  it("reads a valid capability from the room cookie", async () => {
    const capability = createRoomCapability(false);
    cookieStore.get.mockReturnValue({ value: capability.value });

    await expect(readRoomCapability("room-id")).resolves.toEqual(capability.parts);
    expect(cookieStore.get).toHaveBeenCalledWith("qi-room-room-id");
  });

  it("writes a six-hour secure server-only room cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await writeRoomCapability("room-id", "capability-value");

    expect(cookieStore.set).toHaveBeenCalledWith(
      "qi-room-room-id",
      "capability-value",
      {
        httpOnly: true,
        maxAge: 6 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: true,
      },
    );
  });

  it("allows the room cookie over local development HTTP", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await writeRoomCapability("room-id", "capability-value");

    expect(cookieStore.set).toHaveBeenCalledWith(
      "qi-room-room-id",
      "capability-value",
      expect.objectContaining({ secure: false }),
    );
  });

  it("clears only the requested room cookie", async () => {
    await clearRoomCapability("room-id");

    expect(cookieStore.delete).toHaveBeenCalledWith("qi-room-room-id");
  });
});
