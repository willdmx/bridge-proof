import { ZodError } from "zod";
import { AppError } from "./errors";

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof ZodError) return jsonResponse({ error: { code: "INVALID_INPUT", message: "Invalid input. Check evidence length, skill context, and credential identifier." } }, 400);
  return jsonResponse({ error: { code: "SERVICE_UNAVAILABLE", message: "The service could not complete this request. Check server configuration and try again." } }, 503);
}

/** Bound the stream, including chunked requests; Content-Length alone is untrusted. */
export async function readJson(request: Request, maxBytes = 100000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppError("CONTENT_TYPE", "Use application/json.", 415);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new AppError("CROSS_ORIGIN", "Cross-origin write requests are not allowed.", 403);
  if (Number(request.headers.get("content-length")) > maxBytes) throw new AppError("TOO_LARGE", "Request is too large.", 413);
  if (!request.body) throw new AppError("INVALID_JSON", "A JSON request body is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AppError("TOO_LARGE", "Request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400); }
}

// A per-instance safety brake, not distributed abuse protection. Configure host limits too.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(request: Request, operation: "analyze" | "issue"): void {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.reset <= now) buckets.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${operation}:${ip}`;
  const entry = buckets.get(key) ?? { count: 0, reset: now + 60000 };
  const limit = operation === "analyze" ? 10 : 5;
  if (entry.count >= limit || buckets.size >= 10000) throw new AppError("RATE_LIMITED", "Too many requests. Wait a minute and try again.", 429);
  entry.count += 1;
  buckets.set(key, entry);
}
