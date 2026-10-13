import { identifierSchema } from "@/lib/credential";
import { verifyCredential } from "@/lib/solana";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = identifierSchema.parse((await context.params).id);
    return jsonResponse(await verifyCredential(id));
  } catch (error) { return errorResponse(error); }
}
