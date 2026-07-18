import { z } from "zod";

import { readRoomCapability } from "@/online/room-cookies";
import { RATE_LIMITS } from "@/online/request-rate-limit";
import {
  enforceSessionRateLimit,
  jsonResponse,
  parseRoomId,
  requireRoomCapability,
  routeErrorResponse,
} from "@/online/room-route";
import { getRoomService } from "@/online/room-service-provider";

const secretResponseSchema = z.object({ word: z.string().min(1) }).strict();

type RoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RoomRouteContext) {
  try {
    const roomId = parseRoomId((await context.params).roomId);
    const capability = requireRoomCapability(await readRoomCapability(roomId));
    await enforceSessionRateLimit(capability, RATE_LIMITS.secret);
    const result = await getRoomService().secret({ roomId, capability });
    const parsed = secretResponseSchema.safeParse(result);
    if (!parsed.success) throw new Error("Room service returned an invalid secret");

    return jsonResponse(parsed.data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
