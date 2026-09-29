export declare function attachWs(server: import("node:http").Server): import("ws").WebSocketServer;
export declare function broadcast(event: {
  type: string;
  id?: string;
  data?: unknown;
  version?: number;
  folder_id?: string | null;
  file_id?: string | null;
  item?: unknown;
  folder?: unknown;
  device?: { id: string; display_name: string; last_seen?: string };
  ts?: string;
}): void;
export declare function clientCount(): number;