import { z } from "zod";
import {
  PLAYER_COUNTS,
  type Category,
} from "@/game/game-reducer";

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
  category: z.enum(categories),
});

export const joinRoomSchema = z.object({ nickname: nicknameSchema });

const expectedVersion = z.number().int().nonnegative();

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), expectedVersion }),
  z.object({ type: z.literal("ready"), expectedVersion }),
  z.object({ type: z.literal("reveal-imposter"), expectedVersion }),
  z.object({ type: z.literal("reveal-civilian"), expectedVersion }),
  z.object({ type: z.literal("play-again"), expectedVersion }),
  z.object({ type: z.literal("cancel-round"), expectedVersion }),
  z.object({ type: z.literal("close-room"), expectedVersion }),
]);

export const MIN_PLAYERS = PLAYER_COUNTS[0];
export const MAX_PLAYERS = PLAYER_COUNTS.at(-1)!;
