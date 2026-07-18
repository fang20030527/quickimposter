import { z } from "zod";

import { readRoomCapability } from "@/online/room-cookies";
import { RATE_LIMITS } from "@/online/request-rate-limit";
import {
  enforceSessionRateLimit,
  jsonResponse,
  parseJsonBody,
  parseRoomId,
  requireRoomCapability,
  routeErrorResponse,
} from "@/online/room-route";
import { getRoomService } from "@/online/room-service-provider";
import { commandSchema } from "@/online/room-validation";

const commandResponseSchema = z.object({
  ok: z.literal(true),
  version: z.number().int().nonnegative(),
}).strict();

type RoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RoomRouteContext) {
  try {
    const roomId = parseRoomId((await context.params).roomId);
    const capability = requireRoomCapability(await readRoomCapability(roomId));
    await enforceSessionRateLimit(capability, RATE_LIMITS.command);
    const command = await parseJsonBody(request, commandSchema);
    const result = await getRoomService().command({
      roomId,
      capability,
      command,
    });
    const parsed = commandResponseSchema.safeParse(result);
    if (!parsed.success) throw new Error("Room service returned an invalid command result");

    return jsonResponse(parsed.data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
