// helpers for generating safe identifiers / filenames
import { randomBytes, randomUUID } from "node:crypto";

export function uid(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function shortId(prefix, bytes = 6) {
  return `${prefix}_${randomBytes(bytes).toString("hex")}`;
}