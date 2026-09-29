import { NextRequest } from "next/server";
import { json, notFound, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import { requireId } from "@/lib/validation";
import {
  getFile,
  deleteFileRecord,
  getContentByFileId,
  softDeleteContent,
} from "@/server/store.mjs";
import { readStoredStream, deleteStoredFile } from "@/server/storage/files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

/** Download / view a stored file. Served from disk with safe headers. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const id = requireId(params.id);
    const file = await getFile(id);
    if (!file) return notFound("File not found");

    const stream = readStoredStream(file.storage_path); // throws if missing on disk

    const headers = new Headers();
    headers.set("Content-Type", file.mime_type);
    headers.set("Content-Length", String(file.size));
    headers.set("Content-Disposition", `attachment; filename="${sanitizeForHeader(file.original_name)}"`);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("ETag", file.checksum ? `"${file.checksum}"` : `"w-${file.id}"`);

    return new Response(stream as any, { status: 200, headers });
  } catch (err) {
    return handleError(err);
  }
}

/** Remove the file from disk + database. Referencing content is soft-deleted too. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const id = requireId(params.id);
    const file = await getFile(id);
    if (!file) return notFound("File not found");

    const linked = await getContentByFileId(id);
    if (linked) {
      await softDeleteContent(linked.id);
      broadcastEvent({ type: "CONTENT_DELETED", id: linked.id });
    }

    deleteStoredFile(file.storage_path);
    await deleteFileRecord(id);

    broadcastEvent({ type: "FILE_DELETED", id });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

function sanitizeForHeader(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "-").replace(/["\\]/g, "-");
}