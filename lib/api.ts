import { NextResponse } from "next/server";
import { ValidationError } from "./validation";
import { HttpError } from "../server/store.mjs";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const name = (err as Error)?.name;
  if (name === "StorageError" || name === "PayloadTooLargeError") {
    return NextResponse.json({ error: (err as Error).message }, { status: 413 });
  }
  console.error("[api] unhandled", err);
  return NextResponse.json(
    { error: "Could not save changes. Please try again." },
    { status: 500 }
  );
}