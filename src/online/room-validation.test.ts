import { describe, expect, it } from "vitest";
import {
  commandSchema,
  nicknameSchema,
  normalizeNickname,
} from "./room-validation";

describe("online room validation", () => {
  it("trims and normalizes a valid nickname", () => {
    expect(nicknameSchema.parse("  Maya  ")).toBe("Maya");
    expect(normalizeNickname("MÁYA")).toBe("máya");
  });

  it.each(["", "a", " ".repeat(4), "x".repeat(21)])(
    "rejects nickname %j",
    (value) => {
      expect(() => nicknameSchema.parse(value)).toThrow();
    },
  );

  it("rejects nicknames containing invisible control characters", () => {
    expect(() => nicknameSchema.parse("Ma\u0000ya")).toThrow();
  });

  it("accepts only declared room commands", () => {
    expect(commandSchema.parse({ type: "ready", expectedVersion: 3 })).toEqual({
      type: "ready",
      expectedVersion: 3,
    });
    expect(() =>
      commandSchema.parse({ type: "skip-reveal", expectedVersion: 3 }),
    ).toThrow();
  });
});
