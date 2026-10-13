import { describe, expect, it } from "vitest";
import { analysisSchema, analyzeRequestSchema, credentialDraftSchema, credentialSchema, issueRequestSchema } from "../lib/credential";
import { validAnalysis, validCredential, validDraft, validEvidence } from "./fixtures";

describe("credential schema", () => {
  it("accepts a valid draft and issued credential", () => {
    expect(credentialDraftSchema.parse(validDraft)).toEqual(validDraft);
    expect(credentialSchema.parse(validCredential)).toEqual(validCredential);
  });

  it.each([
    ["subjectHash", "not-a-hash"],
    ["evidenceHash", "A".repeat(64)],
    ["skill", "Jane Doe's private certificate"],
    ["level", "Expert"],
    ["score", 101],
    ["score", -1],
    ["score", 80.5],
    ["issuer", "Another issuer"],
    ["issuedAt", "yesterday"],
    ["version", "2.0"],
    ["solanaReference", "not-an-address"],
  ])("rejects invalid %s: %s", (field, value) => {
    expect(credentialSchema.safeParse({ ...validCredential, [field]: value }).success).toBe(false);
  });

  it("rejects missing required fields and personal information fields", () => {
    const { evidenceHash: omitted, ...missing } = validCredential;
    expect(omitted).toHaveLength(64);
    expect(credentialSchema.safeParse(missing).success).toBe(false);
    expect(credentialSchema.safeParse({ ...validCredential, name: "Private learner" }).success).toBe(false);
  });
});

describe("analysis schema", () => {
  it("accepts the expected structured response", () => {
    expect(analysisSchema.parse(validAnalysis)).toEqual(validAnalysis);
  });

  it.each([
    { ...validAnalysis, score: "82" },
    { ...validAnalysis, score: 101 },
    { ...validAnalysis, score: 1.5 },
    { ...validAnalysis, summary: "" },
    { ...validAnalysis, rationale: "" },
    { ...validAnalysis, rationale: "x".repeat(2001) },
    { ...validAnalysis, skill: "Private learner's portfolio" },
    { ...validAnalysis, extra: "untrusted output" },
  ])("rejects invalid structured output %#", (analysis) => {
    expect(analysisSchema.safeParse(analysis).success).toBe(false);
  });
});

describe("API input schemas", () => {
  it("accepts evidence and an optional bounded skill context", () => {
    expect(analyzeRequestSchema.parse({ evidence: validEvidence, skillContext: "REST API" })).toEqual({ evidence: validEvidence, skillContext: "REST API" });
  });

  it.each([
    {},
    { evidence: "short" },
    { evidence: " ".repeat(100) },
    { evidence: "x".repeat(20001) },
    { evidence: validEvidence, skillContext: "x".repeat(301) },
    { evidence: validEvidence, score: 100 },
  ])("rejects invalid analyze input %#", (body) => {
    expect(analyzeRequestSchema.safeParse(body).success).toBe(false);
  });

  it("preserves original evidence bytes for hashing", () => {
    const evidence = ` ${validEvidence}\r\n`;
    expect(analyzeRequestSchema.parse({ evidence }).evidence).toBe(evidence);
  });

  it("requires a signed issuance token and rejects client-crafted credentials", () => {
    expect(issueRequestSchema.safeParse({ issuanceToken: "a".repeat(32) }).success).toBe(true);
    expect(issueRequestSchema.safeParse({ issuanceToken: "short" }).success).toBe(false);
    expect(issueRequestSchema.safeParse({ credential: validCredential }).success).toBe(false);
    expect(issueRequestSchema.safeParse({ issuanceToken: "a".repeat(32), credential: validCredential }).success).toBe(false);
  });
});
