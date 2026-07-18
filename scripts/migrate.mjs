import pg from "pg";
import { migrate } from "postgres-migrations";

function directConnectionString() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL_TEST;

  if (!connectionString) {
    throw new Error("Direct Neon database URL is required");
  }

  if (new URL(connectionString).hostname.includes("-pooler.")) {
    throw new Error("Migrations require a direct Neon connection");
  }

  return connectionString;
}

const client = new pg.Client({ connectionString: directConnectionString() });

await client.connect();
try {
  await migrate({ client }, "db/migrations");
} finally {
  await client.end();
}
