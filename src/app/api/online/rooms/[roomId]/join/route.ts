import { writeRoomCapability } from "@/online/room-cookies";
import { RATE_LIMITS } from "@/online/request-rate-limit";
import {
  enforceIpRateLimit,
  jsonResponse,
  parseJsonBody,
  parseRoomId,
  parseSnapshot,
  routeErrorResponse,
} from "@/online/room-route";
import { getRoomService } from "@/online/room-service-provider";
import { joinRoomSchema } from "@/online/room-validation";

type RoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RoomRouteContext) {
  try {
    const roomId = parseRoomId((await context.params).roomId);
    await enforceIpRateLimit(request, RATE_LIMITS.join);
    const input = await parseJsonBody(request, joinRoomSchema);
    const result = await getRoomService().join({ roomId, ...input });
    const snapshot = parseSnapshot(result.snapshot);
    await writeRoomCapability(roomId, result.capability.value);

    return jsonResponse(snapshot);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
