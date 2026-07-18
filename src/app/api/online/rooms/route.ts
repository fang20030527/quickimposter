import { writeRoomCapability } from "@/online/room-cookies";
import { RATE_LIMITS } from "@/online/request-rate-limit";
import {
  enforceIpRateLimit,
  jsonResponse,
  parseJsonBody,
  parseSnapshot,
  routeErrorResponse,
} from "@/online/room-route";
import { getRoomService } from "@/online/room-service-provider";
import { createRoomSchema } from "@/online/room-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await enforceIpRateLimit(request, RATE_LIMITS.create);
    const input = await parseJsonBody(request, createRoomSchema);
    const result = await getRoomService().create(input);
    const snapshot = parseSnapshot(result.snapshot);
    await writeRoomCapability(result.roomId, result.capability.value);

    return jsonResponse(snapshot, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
