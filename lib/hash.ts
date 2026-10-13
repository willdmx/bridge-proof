import { createHash } from "node:crypto";
import { credentialSchema, type SkillCredential } from "./credential";

/** SHA-256 of exact UTF-8 input, including whitespace and line endings. */
export function hashEvidence(evidence: string): string {
  return createHash("sha256").update(evidence, "utf8").digest("hex");
}

/** Fixed field order; never hash arbitrary JSON serialization supplied by clients. */
export function canonicalCredential(input: SkillCredential): string {
  const c = credentialSchema.parse(input);
  return JSON.stringify({
    subjectHash: c.subjectHash, skill: c.skill, level: c.level, score: c.score,
    evidenceHash: c.evidenceHash, issuer: c.issuer, issuedAt: c.issuedAt,
    version: c.version, solanaReference: c.solanaReference,
  });
}
export function hashCredential(credential: SkillCredential): string {
  return hashEvidence(canonicalCredential(credential));
}
