// Applies database/schema.sql against the configured PostgreSQL database.
// Idempotent: safe to run repeatedly.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://localshare:localshare@localhost:5432/localshare";

  const client = new pg.Client({ connectionString });
  await client.connect();

  const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf8");

  try {
    await client.query("BEGIN");
    await client.query(schema);
    await client.query("COMMIT");
    console.log("[db:migrate] schema applied successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[db:migrate] failed to apply schema", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();