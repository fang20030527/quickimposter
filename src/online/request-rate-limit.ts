import "server-only";

import { createHmac } from "node:crypto";

export const RATE_LIMITS = {
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
} as const;

export function clientAddress(request: Request) {
  const platformAddress = request.headers.get("x-real-ip")?.trim();
  if (platformAddress) return platformAddress;

  const forwardedAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  return forwardedAddress || "unknown";
}

export function requestKey(scope: string, identity: string) {
  const secret = process.env.ROOM_RATE_LIMIT_SECRET;
  if (!secret) {
    throw new Error("ROOM_RATE_LIMIT_SECRET is not configured");
  }

  return createHmac("sha256", secret)
    .update(scope)
    .update("\0")
    .update(identity)
    .digest("hex");
}
