import "server-only";

import { cookies } from "next/headers";

import { parseRoomCapability } from "./room-session";

function cookieName(roomId: string) {
  return `qi-room-${roomId}`;
}

export async function readRoomCapability(roomId: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName(roomId))?.value ?? "";

  return parseRoomCapability(value);
}

export async function writeRoomCapability(roomId: string, value: string) {
  const cookieStore = await cookies();

  cookieStore.set(cookieName(roomId), value, {
    httpOnly: true,
    maxAge: 6 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearRoomCapability(roomId: string) {
  const cookieStore = await cookies();

  cookieStore.delete(cookieName(roomId));
}
