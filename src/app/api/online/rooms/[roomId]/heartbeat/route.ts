import { z } from "zod";

import { readRoomCapability } from "@/online/room-cookies";
import { RATE_LIMITS } from "@/online/request-rate-limit";
import {
  ensureEmptyBody,
  enforceSessionRateLimit,
  jsonResponse,
  parseRoomId,
  requireRoomCapability,
  routeErrorResponse,
} from "@/online/room-route";
import { getRoomService } from "@/online/room-service-provider";

const heartbeatResponseSchema = z.object({ ok: z.literal(true) }).strict();

type RoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RoomRouteContext) {
  try {
    const roomId = parseRoomId((await context.params).roomId);
    const capability = requireRoomCapability(await readRoomCapability(roomId));
    await enforceSessionRateLimit(capability, RATE_LIMITS.heartbeat);
    await ensureEmptyBody(request);
    const result = await getRoomService().heartbeat({ roomId, capability });
    const parsed = heartbeatResponseSchema.safeParse(result);
    if (!parsed.success) throw new Error("Room service returned an invalid heartbeat");

    return jsonResponse(parsed.data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
