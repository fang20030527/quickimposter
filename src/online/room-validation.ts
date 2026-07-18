import { z } from "zod";
import {
  PLAYER_COUNTS,
  type Category,
} from "@/game/game-reducer";
import type { RoomSnapshot } from "@/online/room-types";

const categories = [
  "All Categories",
  "Food",
  "Animals",
  "Objects",
  "Places",
  "Entertainment",
  "Sports",
  "Jobs",
  "Nature",
] as const satisfies readonly Category[];

const roomPhases = [
  "lobby",
  "private-reveal",
  "discussion",
  "imposter-revealed",
  "civilian-revealed",
  "closed",
] as const;

const playerStates = [
  "active",
  "waiting",
  "disconnected",
  "removed",
] as const;

export const categorySchema = z.enum(categories);

export const nicknameSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .refine(
    (value) => [...value].every((char) => !/\p{C}/u.test(char)),
    "Use visible characters only",
  );

export const normalizeNickname = (value: string) =>
  value.trim().normalize("NFKC").toLocaleLowerCase("en-US");

export const roomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  category: categorySchema,
}).strict();

export const joinRoomSchema = z.object({ nickname: nicknameSchema }).strict();

const expectedVersion = z.number().int().nonnegative();

export const snapshotQuerySchema = z.object({
  version: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(Number.isSafeInteger)
    .optional(),
}).strict();

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), expectedVersion }).strict(),
  z.object({ type: z.literal("ready"), expectedVersion }).strict(),
  z.object({ type: z.literal("reveal-imposter"), expectedVersion }).strict(),
  z.object({ type: z.literal("reveal-civilian"), expectedVersion }).strict(),
  z.object({ type: z.literal("play-again"), expectedVersion }).strict(),
  z.object({ type: z.literal("cancel-round"), expectedVersion }).strict(),
  z.object({ type: z.literal("close-room"), expectedVersion }).strict(),
]);

const playerSummarySchema = z.object({
  id: z.uuid(),
  nickname: nicknameSchema,
  state: z.enum(playerStates),
  isHost: z.boolean(),
  isReady: z.boolean(),
}).strict();

const roomResultSchema = z.object({
  imposterNickname: nicknameSchema,
  imposterWord: z.string().min(1),
  civilianWord: z.string().min(1).nullable(),
}).strict();

export const roomSnapshotSchema: z.ZodType<RoomSnapshot> = z.object({
  roomId: roomIdSchema,
  phase: z.enum(roomPhases),
  version: z.number().int().nonnegative(),
  category: categorySchema,
  viewerPlayerId: z.uuid().nullable(),
  viewerIsHost: z.boolean(),
  players: z.array(playerSummarySchema),
  readyCount: z.number().int().nonnegative(),
  participantCount: z.number().int().nonnegative(),
  hostAwaySince: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
  result: roomResultSchema.nullable(),
}).strict();

export const MIN_PLAYERS = PLAYER_COUNTS[0];
export const MAX_PLAYERS = PLAYER_COUNTS.at(-1)!;
