import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type CapabilityParts = {
  sessionId: string;
  playerToken: string;
  hostToken: string | null;
};

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function createToken() {
  return randomBytes(32).toString("base64url");
}

export function createRoomCapability(isHost: boolean) {
  const parts: CapabilityParts = {
    sessionId: randomUUID(),
    playerToken: createToken(),
    hostToken: isHost ? createToken() : null,
  };

  return {
    parts,
    value: [parts.sessionId, parts.playerToken, parts.hostToken ?? ""].join("."),
  };
}

export function parseRoomCapability(value: string): CapabilityParts | null {
  const [sessionId, playerToken, hostToken, extra] = value.split(".");

  if (
    extra !== undefined ||
    !SESSION_ID_PATTERN.test(sessionId ?? "") ||
    !TOKEN_PATTERN.test(playerToken ?? "")
  ) {
    return null;
  }

  if (hostToken && !TOKEN_PATTERN.test(hostToken)) {
    return null;
  }

  return { sessionId, playerToken, hostToken: hostToken || null };
}

export async function digestToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function equalDigest(left: string, right: string) {
  if (!DIGEST_PATTERN.test(left) || !DIGEST_PATTERN.test(right)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
