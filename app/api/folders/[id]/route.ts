import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import { requireId, requireDeviceId, validateFolderName } from "@/lib/validation";
import {
  updateFolder,
  softDeleteFolder,
  unfoldContents,
  getContent,
  HttpError,
} from "@/server/store.mjs";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const id = requireId(params.id);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    requireDeviceId(body.device_id);
    const folder = await updateFolder({
      id,
      name: validateFolderName(body.name),
      byDevice: body.device_id,
    });
    if (!folder) throw new HttpError(409, "Folder not found or was deleted");
    broadcastEvent({ type: "FOLDER_UPDATED", folder });
    return json({ folder });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const id = requireId(params.id);
    await softDeleteFolder(id);
    // Content in the folder is un-grouped but NOT deleted or lost.
    const affected = await unfoldContents(id);
    for (const contentId of affected) {
      const item = await getContent(contentId);
      if (!item) continue;
      broadcastEvent({
        type: "CONTENT_UPDATED",
        id: item.id,
        item,
        folder_id: null,
        file_id: item.file?.id ?? null,
        version: item.version,
      });
    }
    broadcastEvent({ type: "FOLDER_DELETED", id });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}