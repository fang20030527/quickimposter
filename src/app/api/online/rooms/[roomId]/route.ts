import { readRoomCapability } from "@/online/room-cookies";
import { RATE_LIMITS } from "@/online/request-rate-limit";
import {
  enforceIpRateLimit,
  enforceSessionRateLimit,
  jsonResponse,
  NO_STORE_HEADERS,
  parseKnownVersion,
  parseRoomId,
  parseSnapshot,
  routeErrorResponse,
} from "@/online/room-route";
import { getRoomService } from "@/online/room-service-provider";

type RoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, context: RoomRouteContext) {
  try {
    const roomId = parseRoomId((await context.params).roomId);
    const knownVersion = parseKnownVersion(request);
    const capability = await readRoomCapability(roomId);

    if (capability) {
      await enforceSessionRateLimit(capability, RATE_LIMITS.snapshotSession);
    } else {
      await enforceIpRateLimit(request, RATE_LIMITS.snapshotGuest);
    }

    const result = await getRoomService().snapshot({
      roomId,
      capability,
      knownVersion,
    });
    if (!result.changed) {
      return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
    }

    return jsonResponse(parseSnapshot(result.snapshot));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
