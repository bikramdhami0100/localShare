import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import { requireDeviceId, ValidationError } from "@/lib/validation";
import { upsertDevice } from "@/server/store.mjs";

export const dynamic = "force-dynamic";

// Register/refresh a device. The device id comes from the browser (localStorage)
// and is used only for sync/audit attribution, never for authentication.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    const id = requireDeviceId(body.device_id);
    const name = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 60) : "";
    if (!name) throw new ValidationError("display_name", "Display name is required");

    const data = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};
    const device = await upsertDevice({ id, displayName: name, metadata: data });

    broadcastEvent({
      type: "DEVICE_CONNECTED",
      device: { id: device.id, display_name: device.display_name, last_seen: device.last_seen },
    });
    return json({ device });
  } catch (err) {
    return handleError(err);
  }
}