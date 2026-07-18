import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  clientAddress,
  RATE_LIMITS,
  requestKey,
} from "./request-rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("online request rate limits", () => {
  it("derives an opaque scoped HMAC identity", () => {
    vi.stubEnv("ROOM_RATE_LIMIT_SECRET", "test-rate-secret");
    const rawIdentity = "203.0.113.4";

    const digest = requestKey("create", rawIdentity);

    expect(digest).toBe(
      createHmac("sha256", "test-rate-secret")
        .update("create")
        .update("\0")
        .update(rawIdentity)
        .digest("hex"),
    );
    expect(digest).not.toContain(rawIdentity);
  });

  it("refuses to derive identities without a server secret", () => {
    vi.stubEnv("ROOM_RATE_LIMIT_SECRET", "");

    expect(() => requestKey("snapshot", "session-id")).toThrow(
      "ROOM_RATE_LIMIT_SECRET is not configured",
    );
  });

  it("declares the confirmed endpoint windows", () => {
    expect(RATE_LIMITS).toEqual({
      create: { action: "create", limit: 10, windowSeconds: 600 },
      join: { action: "join", limit: 30, windowSeconds: 600 },
      snapshotSession: {
        action: "snapshot-session",
        limit: 420,
        windowSeconds: 300,
      },
      snapshotGuest: {
        action: "snapshot-guest",
        limit: 90,
        windowSeconds: 300,
      },
      secret: { action: "secret", limit: 60, windowSeconds: 300 },
      command: { action: "command", limit: 120, windowSeconds: 300 },
      heartbeat: { action: "heartbeat", limit: 30, windowSeconds: 300 },
    });
  });

  it("uses the platform client address without returning an entire proxy chain", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.2" },
    });

    expect(clientAddress(request)).toBe("203.0.113.4");
  });
});
