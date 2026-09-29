import { uid, shortId } from "../server/ids.mjs";

/** Server-side-generated safe IDs, e.g. `content_<uuid>`. */
export { uid, shortId };

/** Compact id for devices, e.g. `device_ab12cd`. */
export function deviceId(): string {
  return shortId("device");
}