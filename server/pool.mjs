// Shared PostgreSQL connection pool.
// Imported by the custom server (server.mjs), the WebSocket hub, and API routes.
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://localshare:localshare@localhost:5432/localshare";

let pool;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // Make pool.query promise-friendly exactly like the pg docs recommend.
    pool.on("error", (err) => {
      console.error("[pg] idle client error", err);
    });
  }
  return pool;
}

export async function checkDatabase() {
  const p = getPool();
  const res = await p.query("SELECT now() AS now");
  return res.rows[0].now;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}