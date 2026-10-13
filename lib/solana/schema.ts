import { getAddressDecoder } from "@solana/kit";
import { credentialDraftSchema, type AnalysisMode, type CredentialDraft, type SkillCredential } from "../credential";
import { hashCredential, hashEvidence } from "../hash";

export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const CREDENTIAL_NAME = "BRIDGE_PROOF";
export const SCHEMA_NAME = "BRIDGE_PROOF_SKILL_V1";
export const SCHEMA_VERSION = 1;
export const SCHEMA_DESCRIPTION = "Bridge Proof v1: public skill assessment, SHA-256 commitments, AI provenance. No personal information or raw evidence.";
export const ATTESTATION_TTL_SECONDS = 365 * 24 * 60 * 60;
export const SCHEMA_FIELDS = [
  "subjectHash", "skill", "level", "score", "evidenceHash", "issuer", "issuedAt",
  "version", "solanaReference", "credentialHash", "analysisMode",
];
// SAS compact layout: 12 = Borsh string, 0 = u8.
export const SCHEMA_LAYOUT = Uint8Array.from([12, 12, 12, 0, 12, 12, 12, 12, 12, 12, 12]);
export const SCHEMA_FIELD_NAMES_BYTES = Uint8Array.from(Buffer.concat(SCHEMA_FIELDS.map((name) => {
  const bytes = Buffer.from(name, "utf8");
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(bytes.length);
  return Buffer.concat([prefix, bytes]);
})));

/** Domain-separated digest authenticates the full portable credential and AI provenance. */
export function attestationDigest(credential: SkillCredential, analysisMode: AnalysisMode): string {
  return hashEvidence(`bridge-proof:sas:v1:${hashCredential(credential)}:${analysisMode}`);
}

/** Identical signed drafts produce the same account, making issuance retries idempotent. */
export function attestationNonce(input: CredentialDraft, analysisMode: AnalysisMode) {
  const draft = credentialDraftSchema.parse(input);
  const canonical = JSON.stringify({
    subjectHash: draft.subjectHash, skill: draft.skill, level: draft.level, score: draft.score,
    evidenceHash: draft.evidenceHash, issuer: draft.issuer, issuedAt: draft.issuedAt,
    version: draft.version, analysisMode,
  });
  return getAddressDecoder().decode(Buffer.from(hashEvidence(`bridge-proof:nonce:v1:${canonical}`), "hex"));
}

export function explorerAddress(reference: string): string {
  return `https://explorer.solana.com/address/${encodeURIComponent(reference)}?cluster=devnet`;
}
