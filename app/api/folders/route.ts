import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import { uid } from "@/lib/ids";
import { requireDeviceId, validateFolderName, validateFolderId } from "@/lib/validation";
import { listFolders, createFolder, getFolder, HttpError } from "@/server/store.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const folders = await listFolders();
    return json({ folders });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    const deviceId = requireDeviceId(body.device_id);
    const parentId = validateFolderId(body.parent_id);
    const exists = parentId ? await getFolder(parentId) : true;
    if (!exists) throw new HttpError(404, "Parent folder not found");

    const folder = await createFolder({
      id: uid("folder"),
      name: validateFolderName(body.name),
      parentId,
      createdByDevice: deviceId,
    });
    if (!folder) throw new HttpError(500, "Could not create folder");

    broadcastEvent({ type: "FOLDER_CREATED", folder });
    return json({ folder }, 201);
  } catch (err) {
    return handleError(err);
  }
}