import { NextRequest } from "next/server";
import { json, notFound, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import {
  requireId,
  requireDeviceId,
  validateTitle,
  validateBody,
  validateUrl,
  validateFolderId,
  ValidationError,
} from "@/lib/validation";
import { getContent, updateContent, softDeleteContent } from "@/server/store.mjs";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const item = await getContent(requireId(params.id));
    if (!item) return notFound("Content not found");
    return json({ item });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const id = requireId(params.id);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    const deviceId = requireDeviceId(body.device_id);
    const expectedVersion = Number(body.version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new ValidationError("version", "Valid version is required for editing");
    }

    const fields: Record<string, unknown> = {};
    if ("title" in body) fields.title = validateTitle(body.title);
    if ("body" in body) fields.body = validateBody(body.body);
    if ("url" in body) fields.url = validateUrl(body.url);
    if ("folder_id" in body) fields.folder_id = validateFolderId(body.folder_id);

    const item = await updateContent({
      id,
      expectedVersion,
      fields,
      byDevice: deviceId,
    });
    if (!item) throw new ValidationError("version", "Content item was deleted or no longer exists");

    broadcastEvent({
      type: "CONTENT_UPDATED",
      id: item.id,
      item,
      folder_id: item.folder_id,
      file_id: item.file?.id ?? null,
      version: item.version,
    });
    return json({ item });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const id = requireId(params.id);
    await softDeleteContent(id);
    broadcastEvent({ type: "CONTENT_DELETED", id });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}