import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { json, handleError } from "@/lib/api";
import { broadcastEvent } from "@/lib/broadcast";
import { uid } from "@/lib/ids";
import {
  sanitizeFilename,
  validateMime,
  requireDeviceId,
  isDangerousExtension,
  ValidationError,
} from "@/lib/validation";
import {
  storeUploadedStream,
  deleteStoredFile,
  DEFAULT_MAX_BYTES,
} from "@/server/storage/files";
import { createFileRecord, createContent } from "@/server/store.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/files/upload
 * Raw binary body = the file bytes.
 * Headers:
 *   x-file-name    original filename (used only for display)
 *   x-file-mime    declared mime type
 *   x-device-id    device id
 * The file streams to disk (large-file friendly), sha256 is computed, metadata
 * is stored in PostgreSQL, then a `file` content item is created and broadcast.
 */
export async function POST(req: NextRequest) {
  let storedName: string | null = null;
  try {
    const fileName = sanitizeFilename(req.headers.get("x-file-name"));
    const mime = validateMime(req.headers.get("x-file-mime"));
    const deviceId = requireDeviceId(req.headers.get("x-device-id"));

    const declared = Number(req.headers.get("x-file-size") || req.headers.get("content-length") || 0);
    if (declared > DEFAULT_MAX_BYTES) {
      throw new ValidationError("file", `File exceeds maximum size of ${DEFAULT_MAX_BYTES} bytes`);
    }

    const uploadStream = req.body
      ? Readable.fromWeb(req.body as import("stream/web").ReadableStream)
      : null;
    if (!uploadStream) throw new ValidationError("file", "Missing upload body");

    const { storedName: sn, size, checksum } = await storeUploadedStream(uploadStream);
    storedName = sn;

    const file = await createFileRecord({
      id: uid("file"),
      originalName: fileName,
      storedName: sn,
      mimeType: mime,
      size,
      checksum,
      storagePath: sn,
      uploadedByDevice: deviceId,
    });

    const item = await createContent({
      id: uid("content"),
      type: "file",
      title: fileName,
      body: "",
      url: null,
      fileId: file.id,
      folderId: null,
      createdByDevice: deviceId,
    });
    if (!item) throw new ValidationError("file", "Could not create content item for upload");

    broadcastEvent({
      type: "FILE_CREATED",
      id: file.id,
      item,
      file_id: file.id,
      folder_id: null,
      version: item.version,
    });

    const dangerous = isDangerousExtension(fileName);
    return json({ file, item, checksum, dangerous: dangerous ? true : undefined }, 201);
  } catch (err) {
    // Never leave orphan bytes behind on disk if persistence failed.
    if (storedName) {
      try {
        deleteStoredFile(storedName);
      } catch {
        /* best effort */
      }
    }
    return handleError(err);
  }
}