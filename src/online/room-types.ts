import type { Category } from "@/game/game-reducer";

export type RoomPhase =
  | "lobby"
  | "private-reveal"
  | "discussion"
  | "imposter-revealed"
  | "civilian-revealed"
  | "closed";

export type PlayerState =
  | "active"
  | "waiting"
  | "disconnected"
  | "removed";

export type PlayerSummary = {
  id: string;
  nickname: string;
  state: PlayerState;
  isHost: boolean;
  isReady: boolean;
};

export type RoomSnapshot = {
  roomId: string;
  phase: RoomPhase;
  version: number;
  category: Category;
  viewerPlayerId: string | null;
  viewerIsHost: boolean;
  players: PlayerSummary[];
  readyCount: number;
  participantCount: number;
  hostAwaySince: string | null;
  expiresAt: string;
  result: null | {
    imposterNickname: string;
    imposterWord: string;
    civilianWord: string | null;
  };
};

export type RoomCommand =
  | { type: "start"; expectedVersion: number }
  | { type: "ready"; expectedVersion: number }
  | { type: "reveal-imposter"; expectedVersion: number }
  | { type: "reveal-civilian"; expectedVersion: number }
  | { type: "play-again"; expectedVersion: number }
  | { type: "cancel-round"; expectedVersion: number }
  | { type: "close-room"; expectedVersion: number };

export type ApiErrorCode =
  | "invalid-request"
  | "not-found"
  | "room-full"
  | "nickname-taken"
  | "unauthorized"
  | "conflict"
  | "room-closed"
  | "rate-limited"
  | "unavailable";
