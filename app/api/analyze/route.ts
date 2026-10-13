import { analyzeRequestSchema } from "@/lib/credential";
import { analyzeEvidence } from "@/lib/ai";
import { createCredentialDraft, signIssuance } from "@/lib/issuance-token";
import { errorResponse, jsonResponse, rateLimit, readJson } from "@/lib/http";
import { isReadOnlyDemo } from "@/lib/deployment";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (isReadOnlyDemo()) {
    return jsonResponse({ error: { code: "READ_ONLY_DEMO", message: "Public demonstration is read-only. View the existing credential with its clearly labeled simulated assessment." } }, 403);
  }
  try {
    const input = analyzeRequestSchema.parse(await readJson(request));
    rateLimit(request, "analyze");
    const { analysis, analysisMode } = await analyzeEvidence(input.evidence, input.skillContext);
    const credential = createCredentialDraft(analysis, input.evidence);
    return jsonResponse({ analysis, analysisMode, credential, ...signIssuance(credential, analysisMode) });
  } catch (error) { return errorResponse(error); }
}
