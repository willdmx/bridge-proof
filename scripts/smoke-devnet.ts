import assert from "node:assert/strict";
import { credentialSchema } from "../lib/credential";
import { hashEvidence } from "../lib/hash";
import { mkdir, writeFile } from "node:fs/promises";

// Zero-cost analysis acceptance test; uses real Devnet SOL for actual SAS issuance.
const evidence = "I built a REST API in TypeScript for a task list. I implemented GET, POST, PATCH, and DELETE endpoints with JSON schema validation. I used parameterized SQL queries and wrote integration tests for invalid inputs, unauthorized requests, pagination, and missing resources. I documented HTTP response codes and the tradeoff between offset pagination and cursor pagination. This is synthetic evidence for Bridge Proof's end-to-end integration test, not a claim about a real learner.";
const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:3000";

async function request(path: string, body?: unknown) {
  const response = await fetch(new URL(path, baseUrl), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store", signal: AbortSignal.timeout(125000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.error?.code || response.status} ${data.error?.message || "Request failed"}`);
  return data;
}

async function main() {
  const config = await request("/api/config");
  assert.equal(config.analysisMode, "demo", "Set AI_DEMO_MODE=true on the target server before this zero-cost test. No analysis or issuance was attempted.");
  const analysis = await request("/api/analyze", { evidence, skillContext: "REST API Development" });
  assert.equal(analysis.analysisMode, "demo", "Zero-cost acceptance requires explicitly labeled deterministic analysis. No proof issued.");
  assert.equal(analysis.credential.evidenceHash, hashEvidence(evidence));
  console.log("Deterministic DEMO analysis succeeded; no AI provider called; credential generated.");
  const issued = await request("/api/credentials", { issuanceToken: analysis.issuanceToken });
  const credential = credentialSchema.parse(issued.credential);
  const id = credential.solanaReference;
  // Print identifiers immediately so interruption after submission remains recoverable.
  console.log(`Attestation: ${id}`);
  console.log(`Transaction: ${issued.transactionSignature}`);
  let verification = await request(`/api/verify/${id}`);
  for (let attempt = 0; !verification.verified && attempt < 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    verification = await request(`/api/verify/${id}`);
  }
  assert.equal(verification.verified, true, verification.reason || "Real chain verification failed");
  assert.equal(verification.analysisMode, "demo");
  assert.deepEqual(credentialSchema.parse(verification.credential), credential);
  assert.equal(verification.credential.evidenceHash, hashEvidence(evidence));
  assert.ok(verification.checks.length > 0 && verification.checks.every((check: { passed: boolean }) => check.passed));
  const retrieved = await request(`/api/credentials/${id}`);
  assert.equal(retrieved.verified, true);
  assert.deepEqual(credentialSchema.parse(retrieved.credential), credential);
  await mkdir("docs", { recursive: true });
  await writeFile("docs/devnet-proof.json", JSON.stringify({
    analysisMode: "demo", evidenceHash: hashEvidence(evidence), credential,
    transactionSignature: issued.transactionSignature, verification,
  }, null, 2) + "\n");
  await writeFile("docs/demo-evidence.txt", evidence);
  console.log("PASS: DEMO analysis → credential → real Solana Devnet attestation → fresh retrieval → verified.");
  console.log(`Credential page: ${new URL(`/credential/${id}`, baseUrl)}`);
  console.log(`Explorer: ${verification.explorerUrl}`);
  console.log("Open the credential page to inspect the server-verified UI and compare the original evidence hash.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Live acceptance test failed.");
  process.exitCode = 1;
});
