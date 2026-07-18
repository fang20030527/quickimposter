import "server-only";

import { createRoomRepository } from "@/online/room-repository";
import { createRoomService, type RoomService } from "@/online/room-service";

let roomService: RoomService | null = null;

export function getRoomService() {
  if (!roomService) {
    roomService = createRoomService(createRoomRepository());
  }

  return roomService;
}
