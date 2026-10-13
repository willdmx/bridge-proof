import { describe, expect, it } from "vitest";
import { errorResponse, readJson } from "../lib/http";
import { AppError } from "../lib/errors";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/analyze", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
}

describe("API body validation", () => {
  it("reads valid JSON with a matching origin", async () => {
    await expect(readJson(request('{"evidence":"text"}', { origin: "http://localhost:3000" }))).resolves.toEqual({ evidence: "text" });
  });

  it("rejects malformed JSON and incorrect content type", async () => {
    await expect(readJson(request("{"))).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
    await expect(readJson(request("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ code: "CONTENT_TYPE", status: 415 });
  });

  it("rejects cross-origin writes", async () => {
    await expect(readJson(request("{}", { origin: "https://untrusted.example" }))).rejects.toMatchObject({ code: "CROSS_ORIGIN", status: 403 });
  });

  it("bounds actual request bytes even without Content-Length", async () => {
    await expect(readJson(request(JSON.stringify({ evidence: "x".repeat(100) })), 32)).rejects.toMatchObject({ code: "TOO_LARGE", status: 413 });
  });

  it("rejects an oversized declared body before consuming it", async () => {
    await expect(readJson(request("{}", { "content-length": "100001" }))).rejects.toMatchObject({ code: "TOO_LARGE", status: 413 });
  });
});

describe("API error privacy", () => {
  it("returns an intentional public error and disables caching", async () => {
    const response = errorResponse(new AppError("NOT_READY", "Try again later.", 503));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code: "NOT_READY", message: "Try again later." } });
  });

  it("does not expose unexpected error details", async () => {
    const response = errorResponse(new Error("secret key and private evidence"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret key");
  });
});
