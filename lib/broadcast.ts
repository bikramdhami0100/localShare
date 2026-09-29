// Bridge between typed API routes and the WebSocket hub mounted by server.mjs.
// Events are broadcast ONLY after a change has been persisted to PostgreSQL.
import type { ClientEvent } from "@/types";

type Hub = { broadcast: (event: ClientEvent) => void };

declare global {
  // eslint-disable-next-line no-var
  var __LOCALSHARE_HUB: Hub | undefined;
}

export function broadcastEvent(event: ClientEvent): void {
  globalThis.__LOCALSHARE_HUB?.broadcast(event);
}

export function hubIsConnected(): boolean {
  return Boolean(globalThis.__LOCALSHARE_HUB);
}