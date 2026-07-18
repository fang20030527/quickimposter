import { afterEach, describe, expect, it, vi } from "vitest";

const { PoolMock, attachDatabasePoolMock } = vi.hoisted(() => ({
  PoolMock: vi.fn(),
  attachDatabasePoolMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({ Pool: PoolMock }));
vi.mock("@vercel/functions", () => ({
  attachDatabasePool: attachDatabasePoolMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("Neon database pool", () => {
  it("imports without reading database environment values", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(import("./neon-pool")).resolves.toBeDefined();
    expect(PoolMock).not.toHaveBeenCalled();
    expect(attachDatabasePoolMock).not.toHaveBeenCalled();
  });

  it("rejects access when the database environment is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getDatabasePool } = await import("./neon-pool");

    expect(() => getDatabasePool()).toThrow(
      "Neon database environment is not configured",
    );
    expect(PoolMock).not.toHaveBeenCalled();
    expect(attachDatabasePoolMock).not.toHaveBeenCalled();
  });

  it("creates and registers one reusable pool lazily", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime:secret@ep-example-pooler.aws.neon.tech/neondb?sslmode=require",
    );
    const { getDatabasePool } = await import("./neon-pool");

    const first = getDatabasePool();
    const second = getDatabasePool();

    expect(second).toBe(first);
    expect(PoolMock).toHaveBeenCalledOnce();
    expect(PoolMock).toHaveBeenCalledWith({
      connectionString:
        "postgresql://runtime:secret@ep-example-pooler.aws.neon.tech/neondb?sslmode=require",
      idleTimeoutMillis: 5_000,
      max: 5,
      min: 1,
    });
    expect(attachDatabasePoolMock).toHaveBeenCalledOnce();
    expect(attachDatabasePoolMock).toHaveBeenCalledWith(first);
  });
});
