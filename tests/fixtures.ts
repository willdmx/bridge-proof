import type { Analysis, CredentialDraft, SkillCredential } from "../lib/credential";

export const validAnalysis: Analysis = {
  skill: "REST API Development",
  level: "Intermediate",
  score: 82,
  summary: "The evidence describes building and testing a REST API.",
  rationale: "Input validation, database access, and endpoint tests are demonstrated.",
};

export const validDraft: CredentialDraft = {
  subjectHash: "a".repeat(64),
  skill: validAnalysis.skill,
  level: validAnalysis.level,
  score: validAnalysis.score,
  evidenceHash: "b".repeat(64),
  issuer: "Bridge Proof",
  issuedAt: "2026-10-11T12:00:00.000Z",
  version: "1.0",
};

export const validCredential: SkillCredential = {
  ...validDraft,
  solanaReference: "11111111111111111111111111111111",
};

export const validEvidence = "I built a REST API with input validation, database access, and automated endpoint tests.";
