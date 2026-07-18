import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Neon database environment is not configured");
  }

  pool = new Pool({
    connectionString,
    idleTimeoutMillis: 5_000,
    max: 5,
    min: 1,
  });
  attachDatabasePool(pool);

  return pool;
}
