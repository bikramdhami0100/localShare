import { json } from "@/lib/api";
import { checkDatabase } from "@/server/pool.mjs";
import { clientCount } from "@/server/websocket/hub.mjs";

export async function GET() {
  try {
    const now = await checkDatabase();
    return json({
      status: "ok",
      db: "connected",
      ws_clients: clientCount(),
      time: new Date(now).toISOString(),
    });
  } catch (err) {
    return json({ status: "degraded", db: "error", error: String(err) }, 503);
  }
}