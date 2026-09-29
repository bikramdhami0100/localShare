// Server-side input validation. All writes are validated here BEFORE reaching
// the database or filesystem. Simple pieces for LAN-scale data — no overkill.
import type { ContentType } from "@/types";

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export const MAX_TITLE = 300;
export const MAX_BODY = 100_000;
export const MAX_NAME = 255;

const CONTENT_TYPES: ContentType[] = ["text", "link", "file"];

export function requireId(id: unknown, label = "id"): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    throw new ValidationError(label, "Invalid identifier");
  }
  return id;
}

export function requireDeviceId(id: unknown): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    throw new ValidationError("device_id", "Invalid device id");
  }
  return id;
}

export function validateContentType(value: unknown): ContentType {
  if (!CONTENT_TYPES.includes(value as ContentType)) {
    throw new ValidationError("type", "Content type must be text, link, or file");
  }
  return value as ContentType;
}

export function validateTitle(value: unknown): string {
  const title = value == null ? "" : String(value).trim();
  if (title.length > MAX_TITLE) {
    throw new ValidationError("title", `Title too long (max ${MAX_TITLE} characters)`);
  }
  return title;
}

export function validateBody(value: unknown): string {
  const body = value == null ? "" : String(value).trim();
  if (body.length > MAX_BODY) {
    throw new ValidationError("body", `Body too long (max ${MAX_BODY} characters)`);
  }
  return body;
}

export function validateUrl(value: unknown): string | null {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value).trim();
  if (raw.length > 2048) throw new ValidationError("url", "URL too long");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError("url", "Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("url", "Only http/https URLs are allowed");
  }
  if (!parsed.hostname) throw new ValidationError("url", "Invalid URL");
  return parsed.toString();
}

/** Sanitize a user-provided filename: strip path separators and control chars. */
export function sanitizeFilename(name: unknown): string {
  let raw = typeof name === "string" ? name.trim() : "";
  if (!raw) throw new ValidationError("name", "Missing file name");
  // Strip any path components — never trust separators.
  raw = raw.split(/[\\/]/).pop() ?? raw;
  // Remove control characters and other dangerous bytes.
  raw = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!raw || raw === "." || raw === "..") {
    throw new ValidationError("name", "Invalid file name");
  }
  if (raw.length > MAX_NAME) {
    throw new ValidationError("name", "File name too long");
  }
  return raw;
}

export function validateMime(value: unknown): string {
  const mime = typeof value === "string" && value.trim() ? value.trim() : "application/octet-stream";
  if (mime.length > 255 || !/^[\w.+-]+\/[\w.+-]+$/.test(mime)) {
    throw new ValidationError("mime", "Invalid mime type");
  }
  return mime;
}

export function validateFolderId(value: unknown): string | null {
  if (value == null || value === "") return null;
  return requireId(value, "folder_id");
}

export function validateFolderName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new ValidationError("name", "Folder name is required");
  if (name.length > 255) throw new ValidationError("name", "Folder name too long");
  return name;
}

export function validateSort(value: unknown): "newest" | "oldest" | "updated" | "title" {
  const v = String(value ?? "newest");
  if (["newest", "oldest", "updated", "title"].includes(v)) return v as any;
  return "newest";
}

const CONTENT_HEADER_MAP: Record<string, string> = {
  "application/javascript": "text/plain",
  "text/html": "text/plain",
  "application/xhtml+xml": "text/plain",
  "application/x-sh": "text/plain",
  "application/x-httpd-php": "text/plain",
  "application/x-php": "text/plain",
  "image/svg+xml": "image/svg+xml",
  "application/x-msdownload": "application/octet-stream",
  "application/x-msdos-program": "application/octet-stream",
  "application/x-jar": "application/octet-stream",
};

/**
 * Pick a content-type to serve. Everything ugly/executable-y is downgraded to
 * octet-stream (forces download instead of inline execution) or text/plain.
 */
export function safeServeMime(mime: string): { contentType: string; inline: boolean } {
  const mapped = CONTENT_HEADER_MAP[mime] ?? mime;
  const isInline =
    mapped.startsWith("image/") ||
    mapped === "application/pdf" ||
    mapped.startsWith("text/") ||
    mapped === "audio/mpeg" ||
    mapped === "video/mp4" ||
    mapped === "application/json";
  return { contentType: mapped, inline: isInline };
}

/** File extensions we refuse to keep executable-ish. The check is advisory. */
export function isDangerousExtension(name: string): boolean {
  return /\.(exe|bat|cmd|com|scr|pif|js|jsx|mjs|csh|msi|ps1|psm1|sh|applescript)$/i.test(name);
}