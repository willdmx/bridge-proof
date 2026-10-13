import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCredentialDraft, signIssuance, verifyIssuanceToken } from "../lib/issuance-token";
import { hashEvidence } from "../lib/hash";
import { validAnalysis, validDraft, validEvidence } from "./fixtures";

const now = Date.parse("2026-10-11T12:00:00.000Z");
beforeEach(() => {
  vi.stubEnv("CREDENTIAL_SIGNING_SECRET", "unit-test-only-signing-secret-never-use-this");
  vi.stubEnv("AI_DEMO_MODE", "false");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("credential creation", () => {
  it("hashes exact evidence bytes and creates unlinkable subject handles", () => {
    const evidence = ` ${validEvidence}\r\n`;
    const first = createCredentialDraft(validAnalysis, evidence, new Date(now));
    const second = createCredentialDraft(validAnalysis, evidence, new Date(now));
    expect(first.evidenceHash).toBe(hashEvidence(evidence));
    expect(first.subjectHash).not.toBe(second.subjectHash);
    expect(first).toMatchObject({ skill: validAnalysis.skill, score: validAnalysis.score, issuedAt: new Date(now).toISOString() });
    expect(JSON.stringify(first)).not.toContain(validEvidence);
  });
});

describe("signed issuance previews", () => {
  it("authenticates the draft and preserves its assessment mode", () => {
    const { issuanceToken, expiresAt } = signIssuance(validDraft, "openai", now);
    expect(expiresAt).toBe("2026-10-11T12:15:00.000Z");
    expect(verifyIssuanceToken(issuanceToken, now + 1)).toEqual({ credential: validDraft, analysisMode: "openai", expiresAt: now + 15 * 60 * 1000 });
  });

  it("rejects a client-edited score with the original signature", () => {
    const { issuanceToken } = signIssuance(validDraft, "openai", now);
    const [encoded, signature] = issuanceToken.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    payload.credential.score = 100;
    const changed = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(() => verifyIssuanceToken(`${changed}.${signature}`, now)).toThrow("invalid or expired");
  });

  it.each(["", "single-segment", "one.two.three", "a.@@@", "a.YQ"])("rejects malformed token %s", (token) => {
    expect(() => verifyIssuanceToken(token, now)).toThrow("invalid or expired");
  });

  it("rejects expired previews at the expiry boundary", () => {
    const { issuanceToken } = signIssuance(validDraft, "openai", now);
    expect(() => verifyIssuanceToken(issuanceToken, now + 15 * 60 * 1000)).toThrow("invalid or expired");
  });

  it("rejects a preview after the signing secret changes", () => {
    const { issuanceToken } = signIssuance(validDraft, "openai", now);
    vi.stubEnv("CREDENTIAL_SIGNING_SECRET", "a-different-test-only-secret-with-32-characters");
    expect(() => verifyIssuanceToken(issuanceToken, now)).toThrow("invalid or expired");
  });

  it.each(["development", "production"])("accepts authenticated demo previews with their original provenance in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    const { issuanceToken } = signIssuance(validDraft, "demo", now);
    expect(verifyIssuanceToken(issuanceToken, now).analysisMode).toBe("demo");
  });

  it("rejects a demo preview relabeled by the client as OpenAI", () => {
    const { issuanceToken } = signIssuance(validDraft, "demo", now);
    const [encoded, signature] = issuanceToken.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    payload.analysisMode = "openai";
    const changed = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(() => verifyIssuanceToken(`${changed}.${signature}`, now)).toThrow("invalid or expired");
  });

  it("requires a configured signing secret of at least 32 characters", () => {
    vi.stubEnv("CREDENTIAL_SIGNING_SECRET", "too-short");
    expect(() => signIssuance(validDraft, "openai", now)).toThrow("at least 32 characters");
  });
});
