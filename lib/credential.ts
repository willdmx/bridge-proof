import { z } from "zod";

// A fixed vocabulary prevents model output or user context from leaking PII on-chain.
export const SKILLS = [
  "REST API Development", "Frontend Development", "Backend Development",
  "Solana Development", "Data Analysis", "Software Testing",
  "Technical Communication", "General Technical Skills",
] as const;
export const skillSchema = z.enum(SKILLS);
export const levelSchema = z.enum(["Beginner", "Intermediate", "Advanced"]);
export const analysisModeSchema = z.enum(["openai", "demo"]);
export type AnalysisMode = z.infer<typeof analysisModeSchema>;
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const identifierSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Enter a Solana attestation account address.");

export const analysisSchema = z.object({
  skill: skillSchema,
  level: levelSchema,
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(1000),
  rationale: z.string().min(1).max(2000),
}).strict();
export type Analysis = z.infer<typeof analysisSchema>;

export const credentialDraftSchema = z.object({
  subjectHash: hashSchema,
  skill: skillSchema,
  level: levelSchema,
  score: z.number().int().min(0).max(100),
  evidenceHash: hashSchema,
  issuer: z.literal("Bridge Proof"),
  issuedAt: z.iso.datetime(),
  version: z.literal("1.0"),
}).strict();
export const credentialSchema = credentialDraftSchema.extend({ solanaReference: identifierSchema }).strict();
export type CredentialDraft = z.infer<typeof credentialDraftSchema>;
export type SkillCredential = z.infer<typeof credentialSchema>;

export type VerificationResult = {
  verified: boolean;
  credential?: SkillCredential;
  network: "devnet";
  proofType: "sas";
  attestationAddress: string;
  transactionSignature?: string;
  explorerUrl: string;
  checks: { name: string; passed: boolean }[];
  reason?: string;
  analysisMode?: AnalysisMode;
  verifiedAt: string;
};

export const analyzeRequestSchema = z.object({
  evidence: z.string().max(20000).refine((value) => value.trim().length >= 50, "Provide at least 50 characters of evidence."),
  skillContext: z.string().max(300).optional(),
}).strict();
export const issueRequestSchema = z.object({ issuanceToken: z.string().min(20).max(12000) }).strict();
