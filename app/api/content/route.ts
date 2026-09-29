import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import { uid } from "@/lib/ids";
import {
  ValidationError,
  validateContentType,
  validateTitle,
  validateBody,
  validateUrl,
  validateFolderId,
  requireDeviceId,
  validateSort,
} from "@/lib/validation";
import {
  listContent,
  createContent,
} from "@/server/store.mjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const items = await listContent({
      folderId: sp.get("folder_id") ?? undefined,
      search: sp.get("q") ?? undefined,
      type: (sp.get("type") as any) ?? undefined,
      sort: validateSort(sp.get("sort")),
      version: sp.get("since") ? Number(sp.get("since")) : undefined,
    });
    return json({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    const deviceId = requireDeviceId(body.device_id);
    const type = validateContentType(body.type);
    const folderId = validateFolderId(body.folder_id);

    const item = await createContent({
      id: uid("content"),
      type,
      title: validateTitle(body.title),
      body: validateBody(body.body),
      url: type === "link" ? validateUrl(body.url) : null,
      fileId: type === "file" ? requireFileId(body.file_id) : undefined,
      folderId,
      createdByDevice: deviceId,
    });
    if (!item) throw new ValidationError("title", "Could not create content item");

    broadcastEvent({
      type: "CONTENT_CREATED",
      id: item.id,
      item,
      folder_id: item.folder_id,
      file_id: item.file?.id ?? null,
      version: item.version,
    });
    return json({ item }, 201);
  } catch (err) {
    return handleError(err);
  }
}

function requireFileId(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) {
    throw new ValidationError("file_id", "file_id is required for file content");
  }
  return value;
}