import "server-only";

import { ZodError, type ZodType } from "zod";

import {
  clientAddress,
  requestKey,
} from "@/online/request-rate-limit";
import { RoomServiceError } from "@/online/room-service";
import { getRoomService } from "@/online/room-service-provider";
import type { CapabilityParts } from "@/online/room-session";
import type { ApiErrorCode, RoomSnapshot } from "@/online/room-types";
import {
  roomIdSchema,
  roomSnapshotSchema,
  snapshotQuerySchema,
} from "@/online/room-validation";

const MAX_REQUEST_BODY_BYTES = 4_096;

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

type RateLimitRule = {
  action: string;
  limit: number;
  windowSeconds: number;
};

class InvalidRouteRequest extends Error {}

function invalidRequest(): never {
  throw new InvalidRouteRequest();
}

async function readBoundedText(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_REQUEST_BODY_BYTES) {
      invalidRequest();
    }
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The request is rejected regardless of whether the stream can be cancelled.
      }
      invalidRequest();
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>) {
  try {
    const text = await readBoundedText(request);
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof InvalidRouteRequest) throw error;
    if (error instanceof ZodError || error instanceof SyntaxError) {
      invalidRequest();
    }
    throw error;
  }
}

export async function ensureEmptyBody(request: Request) {
  const text = await readBoundedText(request);
  if (text.length > 0) invalidRequest();
}

export function parseRoomId(value: string) {
  const result = roomIdSchema.safeParse(value);
  if (!result.success) invalidRequest();
  return result.data;
}

export function parseKnownVersion(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.getAll("version").length > 1) invalidRequest();

  const query = Object.fromEntries(searchParams.entries());
  const result = snapshotQuerySchema.safeParse(query);
  if (!result.success) invalidRequest();
  return result.data.version ?? null;
}

export function parseSnapshot(value: unknown): RoomSnapshot {
  const result = roomSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Room service returned an invalid snapshot");
  }
  return result.data;
}

async function enforceRateLimit(identity: string, rule: RateLimitRule) {
  await getRoomService().checkRateLimit({
    keyDigest: requestKey(rule.action, identity),
    action: rule.action,
    limit: rule.limit,
    windowSeconds: rule.windowSeconds,
  });
}

export function enforceIpRateLimit(request: Request, rule: RateLimitRule) {
  return enforceRateLimit(clientAddress(request), rule);
}

export function enforceSessionRateLimit(
  capability: CapabilityParts,
  rule: RateLimitRule,
) {
  return enforceRateLimit(capability.sessionId, rule);
}

export function requireRoomCapability(
  capability: CapabilityParts | null,
): CapabilityParts {
  if (!capability) throw new RoomServiceError("unauthorized");
  return capability;
}

export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: NO_STORE_HEADERS });
}

const ERROR_STATUSES: Record<ApiErrorCode, number> = {
  "invalid-request": 400,
  "not-found": 404,
  "room-full": 409,
  "nickname-taken": 409,
  "unauthorized": 401,
  "conflict": 409,
  "room-closed": 410,
  "rate-limited": 429,
  "unavailable": 503,
};

export function routeErrorResponse(error: unknown) {
  if (error instanceof InvalidRouteRequest) {
    return jsonResponse({ error: "invalid-request" }, 400);
  }

  if (error instanceof RoomServiceError) {
    return jsonResponse({ error: error.code }, ERROR_STATUSES[error.code]);
  }

  return jsonResponse({ error: "unavailable" }, 503);
}
