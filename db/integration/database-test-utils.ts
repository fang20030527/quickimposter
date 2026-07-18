import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;

function testConnectionString() {
  const connectionString = process.env.DATABASE_URL_TEST;

  if (!connectionString) {
    throw new Error("DATABASE_URL_TEST is required for database integration tests");
  }

  if (new URL(connectionString).hostname.includes("-pooler.")) {
    throw new Error("Database integration tests require a direct Neon connection");
  }

  return connectionString;
}

export function ownerPool() {
  pool ??= new Pool({ connectionString: testConnectionString(), max: 4 });
  return pool;
}

async function rollback(client: PoolClient) {
  try {
    await client.query("rollback");
  } catch {
    // Preserve the error from the operation that caused the transaction to abort.
  }
}

export async function withRuntimeRole<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await ownerPool().connect();

  try {
    await client.query("begin");
    await client.query("set local role quickimposter_app");
    const result = await operation(client);
    await client.query("rollback");
    return result;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function resetDatabase() {
  await ownerPool().query(`
    update private.rooms
    set current_round_id = null, host_player_id = null;
    delete from private.round_players;
    delete from private.room_sessions;
    delete from private.rounds;
    delete from private.players;
    delete from private.rooms;
    delete from private.rate_limit_buckets;
  `);
}

export async function closeOwnerPool() {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
