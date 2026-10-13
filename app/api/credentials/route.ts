import { issueRequestSchema, type SkillCredential, type VerificationResult } from "@/lib/credential";
import { verifyIssuanceToken } from "@/lib/issuance-token";
import { issueCredential, verifyCredential, PendingSolanaTransactionError } from "@/lib/solana";
import { errorResponse, jsonResponse, rateLimit, readJson } from "@/lib/http";
import { isReadOnlyDemo } from "@/lib/deployment";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (isReadOnlyDemo()) {
    return jsonResponse({ error: { code: "READ_ONLY_DEMO", message: "Public demonstration is read-only. Credential signing and issuance are disabled." } }, 403);
  }
  try {
    const input = issueRequestSchema.parse(await readJson(request, 16000));
    const { credential: draft, analysisMode } = verifyIssuanceToken(input.issuanceToken);
    rateLimit(request, "issue");
    let credential: SkillCredential;
    let transactionSignature: string;
    try {
      ({ credential, transactionSignature } = await issueCredential(draft, analysisMode));
    } catch (error) {
      if (!(error instanceof PendingSolanaTransactionError)) throw error;
      credential = { ...draft, solanaReference: error.reference };
      transactionSignature = error.transactionSignature;
      return jsonResponse({ credential, transactionSignature, verification: pendingVerification(credential, analysisMode) }, 202);
    }
    // Success of a send operation never implies verified status. Fetch independently.
    let verification: VerificationResult;
    try { verification = await verifyCredential(credential.solanaReference); }
    catch { verification = pendingVerification(credential, analysisMode); }
    return jsonResponse({ credential, transactionSignature, verification }, verification.verified ? 201 : 202);
  } catch (error) { return errorResponse(error); }
}

function pendingVerification(credential: SkillCredential, analysisMode: "demo" | "openai"): VerificationResult {
  return {
    verified: false, network: "devnet", proofType: "sas", analysisMode,
    attestationAddress: credential.solanaReference,
    explorerUrl: `https://explorer.solana.com/address/${credential.solanaReference}?cluster=devnet`,
    checks: [], verifiedAt: new Date().toISOString(),
    reason: "Transaction submitted; confirmation or independent verification is pending. Retry verification using this attestation address.",
  };
}
