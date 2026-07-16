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

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

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
import { createAdminClient } from "./supabase-admin";
import { createRealtimeClient } from "./supabase-browser";

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

describe("Supabase admin client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads safely without server environment values", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => createAdminClient()).toThrow(
      "Supabase server environment is not configured",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates a non-persistent client with server credentials on demand", () => {
    const client = { kind: "admin-client" };
    createClientMock.mockReturnValue(client);
    vi.stubEnv("SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");

    expect(createAdminClient()).toBe(client);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://project-ref.supabase.co",
      "service-role-secret",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  });
});

describe("Supabase Realtime client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a non-persistent client with public credentials on demand", () => {
    const client = { kind: "realtime-client" };
    createClientMock.mockReturnValue(client);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    expect(createRealtimeClient()).toBe(client);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://project-ref.supabase.co",
      "publishable-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  });
});
