import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const services = vi.hoisted(() => ({
  analyze: vi.fn(), issue: vi.fn(), verify: vi.fn(),
  PendingError: class extends Error {
    constructor(public reference: string, public transactionSignature: string) { super("Confirmation pending"); }
  },
}));
vi.mock("../lib/ai", () => ({ analyzeEvidence: services.analyze }));
vi.mock("../lib/solana", () => ({ issueCredential: services.issue, verifyCredential: services.verify, PendingSolanaTransactionError: services.PendingError }));

import { POST as analyze } from "../app/api/analyze/route";
import { POST as issue } from "../app/api/credentials/route";
import { GET as getCredential } from "../app/api/credentials/[id]/route";
import { GET as verify } from "../app/api/verify/[id]/route";
import { GET as config } from "../app/api/config/route";
import { signIssuance } from "../lib/issuance-token";
import * as issuanceTokens from "../lib/issuance-token";
import * as http from "../lib/http";
import { validAnalysis, validCredential, validDraft, validEvidence } from "./fixtures";

let requestCounter = 0;
function post(path: string, body: unknown) {
  return new Request(`http://localhost:3000/api/${path}`, {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `test-${++requestCounter}` }, body: JSON.stringify(body),
  });
}
function verification(verified: boolean) {
  return { verified, credential: verified ? validCredential : undefined, network: "devnet", proofType: "sas", attestationAddress: validCredential.solanaReference, explorerUrl: "https://explorer.solana.com", checks: [], verifiedAt: new Date().toISOString() };
}

beforeEach(() => {
  services.analyze.mockReset();
  services.issue.mockReset();
  services.verify.mockReset();
  vi.stubEnv("BRIDGE_PROOF_READ_ONLY", "false");
  vi.stubEnv("CREDENTIAL_SIGNING_SECRET", "unit-test-only-signing-secret-never-use-this");
  vi.stubEnv("AI_DEMO_MODE", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-provider-key-not-for-disclosure");
});
afterEach(() => vi.unstubAllEnvs());

describe("public read-only deployment", () => {
  it.each([undefined, "true", "", "unexpected"])("blocks writes before input, token, provider, or chain work (%s)", async (setting) => {
    const token = signIssuance(validDraft, "demo");
    vi.stubEnv("BRIDGE_PROOF_READ_ONLY", setting);
    vi.stubEnv("AI_DEMO_MODE", "false");
    vi.stubEnv("CREDENTIAL_SIGNING_SECRET", "");
    const readJson = vi.spyOn(http, "readJson");
    const createDraft = vi.spyOn(issuanceTokens, "createCredentialDraft");
    const sign = vi.spyOn(issuanceTokens, "signIssuance");
    const verifyToken = vi.spyOn(issuanceTokens, "verifyIssuanceToken");

    for (const response of [
      await analyze(post("analyze", { evidence: validEvidence })),
      await issue(post("credentials", { issuanceToken: token.issuanceToken })),
    ]) {
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("READ_ONLY_DEMO");
    }

    expect(readJson).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
    expect(services.analyze).not.toHaveBeenCalled();
    expect(services.issue).not.toHaveBeenCalled();
    expect(services.verify).not.toHaveBeenCalled();
  });

  it("still independently verifies existing credentials without signing or AI credentials", async () => {
    vi.stubEnv("BRIDGE_PROOF_READ_ONLY", "true");
    vi.stubEnv("CREDENTIAL_SIGNING_SECRET", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    services.verify.mockResolvedValue(verification(true));
    const response = await verify(new Request("http://localhost:3000"), { params: Promise.resolve({ id: validCredential.solanaReference }) });
    expect(response.status).toBe(200);
    expect((await response.json()).verified).toBe(true);
    expect(services.verify).toHaveBeenCalledWith(validCredential.solanaReference);
    expect(services.analyze).not.toHaveBeenCalled();
    expect(services.issue).not.toHaveBeenCalled();
  });
});

describe("GET /api/config", () => {
  it("reveals only public configuration and honors demo mode over a configured key", async () => {
    const response = config();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ analysisMode: "demo", readOnly: false, network: "devnet", proofType: "sas" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(services.analyze).not.toHaveBeenCalled();
  });

  it("reports real mode only when demo is disabled and a key is available", async () => {
    vi.stubEnv("AI_DEMO_MODE", "false");
    expect((await config().json()).analysisMode).toBe("openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await config().json()).analysisMode).toBe("demo");
  });

  it("reports the fail-closed public default without exposing configured secrets", async () => {
    vi.stubEnv("BRIDGE_PROOF_READ_ONLY", undefined);
    vi.stubEnv("AI_DEMO_MODE", "false");
    expect(await config().json()).toEqual({ analysisMode: "demo", readOnly: true, network: "devnet", proofType: "sas" });
  });
});

describe("POST /api/analyze", () => {
  it("validates input before calling AI", async () => {
    const response = await analyze(post("analyze", { evidence: "too short" }));
    expect(response.status).toBe(400);
    expect(services.analyze).not.toHaveBeenCalled();
  });

  it.each(["demo", "openai"])("returns an authenticated preview with %s provenance", async (analysisMode) => {
    services.analyze.mockResolvedValue({ analysis: validAnalysis, analysisMode });
    const response = await analyze(post("analyze", { evidence: validEvidence }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.analysis).toEqual(validAnalysis);
    expect(result.analysisMode).toBe(analysisMode);
    expect(result.credential.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.issuanceToken).toContain(".");
    expect(result.credential.solanaReference).toBeUndefined();
  });
});

describe("POST /api/credentials", () => {
  it("rejects fabricated credentials before sending anything on-chain", async () => {
    const response = await issue(post("credentials", { credential: validCredential }));
    expect(response.status).toBe(400);
    expect(services.issue).not.toHaveBeenCalled();
  });

  it("rejects invalid signatures before issuance", async () => {
    const response = await issue(post("credentials", { issuanceToken: "invalid-token-value.invalid-signature" }));
    expect(response.status).toBe(400);
    expect(services.issue).not.toHaveBeenCalled();
  });

  it.each([true, false])("independently verifies after issuance (verified=%s)", async (isVerified) => {
    services.issue.mockResolvedValue({ credential: validCredential, transactionSignature: "test-transaction-signature" });
    services.verify.mockResolvedValue(verification(isVerified));
    const token = signIssuance(validDraft, "openai");
    const response = await issue(post("credentials", { issuanceToken: token.issuanceToken }));
    const result = await response.json();
    expect(services.issue).toHaveBeenCalledWith(validDraft, "openai");
    expect(services.verify).toHaveBeenCalledWith(validCredential.solanaReference);
    expect(response.status).toBe(isVerified ? 201 : 202);
    expect(result.verification.verified).toBe(isVerified);
  });

  it("preserves submitted transaction details without declaring success when confirmation is pending", async () => {
    services.issue.mockRejectedValue(new services.PendingError(validCredential.solanaReference, "pending-transaction-signature"));
    const token = signIssuance(validDraft, "openai");
    const response = await issue(post("credentials", { issuanceToken: token.issuanceToken }));
    const result = await response.json();
    expect(response.status).toBe(202);
    expect(result.credential.solanaReference).toBe(validCredential.solanaReference);
    expect(result.transactionSignature).toBe("pending-transaction-signature");
    expect(result.verification.verified).toBe(false);
    expect(services.verify).not.toHaveBeenCalled();
  });

  it("retains the proof reference when verification RPC fails after submission", async () => {
    services.issue.mockResolvedValue({ credential: validCredential, transactionSignature: "submitted-transaction-signature" });
    services.verify.mockRejectedValue(new Error("RPC temporarily unavailable"));
    const token = signIssuance(validDraft, "openai");
    const response = await issue(post("credentials", { issuanceToken: token.issuanceToken }));
    const result = await response.json();
    expect(response.status).toBe(202);
    expect(result.credential.solanaReference).toBe(validCredential.solanaReference);
    expect(result.transactionSignature).toBe("submitted-transaction-signature");
    expect(result.verification.verified).toBe(false);
  });
});

describe.each([["credential", getCredential], ["verification", verify]] as const)("GET %s", (_name, handler) => {
  it("rejects invalid account identifiers before fetching RPC state", async () => {
    const response = await handler(new Request("http://localhost:3000"), { params: Promise.resolve({ id: "not-valid" }) });
    expect(response.status).toBe(400);
    expect(services.verify).not.toHaveBeenCalled();
  });

  it("fetches and returns verification without a local issuance record", async () => {
    services.verify.mockResolvedValue(verification(true));
    const response = await handler(new Request("http://localhost:3000"), { params: Promise.resolve({ id: validCredential.solanaReference }) });
    expect(services.verify).toHaveBeenCalledWith(validCredential.solanaReference);
    expect(response.status).toBe(200);
    expect((await response.json()).verified).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
