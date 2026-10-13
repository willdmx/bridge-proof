import { getAnalysisMode } from "@/lib/analysis-mode";
import { jsonResponse } from "@/lib/http";
import { isReadOnlyDemo } from "@/lib/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return jsonResponse({ analysisMode: getAnalysisMode(), readOnly: isReadOnlyDemo(), network: "devnet", proofType: "sas" });
}
