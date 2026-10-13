import type { AnalysisMode } from "./credential";
import { isReadOnlyDemo } from "./deployment";

/** Explicit demo mode always wins, so a stored API key cannot cause accidental spend. */
export function getAnalysisMode(): AnalysisMode {
  return isReadOnlyDemo() || process.env.AI_DEMO_MODE === "true" || !process.env.OPENAI_API_KEY?.trim()
    ? "demo" : "openai";
}
