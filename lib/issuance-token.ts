import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { analysisModeSchema, credentialDraftSchema, type Analysis, type CredentialDraft, type AnalysisMode } from "./credential";
import { hashEvidence } from "./hash";
import { AppError } from "./errors";

const tokenPayloadSchema = z.object({
  credential: credentialDraftSchema,
  analysisMode: analysisModeSchema,
  expiresAt: z.number().int().positive(),
}).strict();
export type IssuancePayload = z.infer<typeof tokenPayloadSchema>;

function signingSecret(): string {
  const secret = process.env.CREDENTIAL_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError("SIGNING_NOT_CONFIGURED", "Set CREDENTIAL_SIGNING_SECRET to a random secret of at least 32 characters.", 503);
  }
  return secret;
}

export function createCredentialDraft(analysis: Analysis, evidence: string, now = new Date()): CredentialDraft {
  return credentialDraftSchema.parse({
    // An unlinkable, random subject handle. It makes no identity/ownership claim.
    subjectHash: hashEvidence(randomBytes(32).toString("hex")),
    skill: analysis.skill, level: analysis.level, score: analysis.score,
    evidenceHash: hashEvidence(evidence), issuer: "Bridge Proof",
    issuedAt: now.toISOString(), version: "1.0",
  });
}

export function signIssuance(credential: CredentialDraft, analysisMode: AnalysisMode, now = Date.now()) {
  const expiresAt = now + 15 * 60 * 1000;
  const payload = tokenPayloadSchema.parse({ credential, analysisMode, expiresAt });
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  return { issuanceToken: `${encoded}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyIssuanceToken(token: string, now = Date.now()): IssuancePayload {
  const secret = signingSecret();
  const invalid = () => new AppError("INVALID_PREVIEW", "This credential preview is invalid or expired. Analyze the evidence again.", 400);
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw invalid();
  const [encoded, signature] = parts;
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalid();
  try {
    const payload = tokenPayloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    if (payload.expiresAt <= now || payload.expiresAt > now + 15 * 60 * 1000) throw invalid();
    // Demo provenance remains signed and is recorded on-chain in every environment.
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalid();
  }
}
