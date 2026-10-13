import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { parse: provider.parse };
  },
}));

import { analyzeEvidence, deterministicAnalysis, parseAnalysis } from "../lib/ai";
import { validAnalysis, validEvidence } from "./fixtures";

beforeEach(() => {
  provider.parse.mockReset();
  vi.stubEnv("BRIDGE_PROOF_READ_ONLY", "false");
  vi.stubEnv("OPENAI_API_KEY", "test-provider-key");
  vi.stubEnv("OPENAI_MODEL", "test-configured-model");
  vi.stubEnv("AI_DEMO_MODE", "false");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("AI structured output", () => {
  it("parses only valid structured assessments", () => {
    expect(parseAnalysis(validAnalysis)).toEqual(validAnalysis);
    expect(() => parseAnalysis(JSON.stringify(validAnalysis))).toThrow();
    expect(() => parseAnalysis({ ...validAnalysis, score: "82" })).toThrow();
    expect(() => parseAnalysis({ ...validAnalysis, skill: "Private personal detail" })).toThrow();
  });

  it("uses the configured model and Responses API schema output without storing responses", async () => {
    provider.parse.mockResolvedValue({ status: "completed", output_parsed: validAnalysis });
    await expect(analyzeEvidence(validEvidence, "REST")).resolves.toEqual({ analysis: validAnalysis, analysisMode: "openai" });
    expect(provider.parse).toHaveBeenCalledWith(expect.objectContaining({
      model: "test-configured-model",
      store: false,
      text: { format: expect.objectContaining({ type: "json_schema", strict: true, name: "skill_analysis" }) },
    }));
  });

  it.each([
    { status: "incomplete", output_parsed: validAnalysis },
    { status: "completed", output_parsed: null },
  ])("rejects incomplete output or a refusal %#", async (response) => {
    provider.parse.mockResolvedValue(response);
    await expect(analyzeEvidence(validEvidence)).rejects.toMatchObject({ code: "AI_NO_RESULT", status: 422 });
  });

  it("revalidates provider output before creating a credential", async () => {
    provider.parse.mockResolvedValue({ status: "completed", output_parsed: { ...validAnalysis, score: 999 } });
    await expect(analyzeEvidence(validEvidence)).rejects.toMatchObject({ code: "AI_FAILED", status: 502 });
  });

  it("does not silently fall back or expose provider details on provider failure", async () => {
    provider.parse.mockRejectedValue(new Error("private evidence or provider credential"));
    await expect(analyzeEvidence(validEvidence)).rejects.toMatchObject({ code: "AI_FAILED" });
    await expect(analyzeEvidence(validEvidence)).rejects.not.toThrow("private evidence");
  });

  it("requires the model instead of silently selecting one", async () => {
    vi.stubEnv("OPENAI_MODEL", "");
    await expect(analyzeEvidence(validEvidence)).rejects.toMatchObject({ code: "AI_MODEL_MISSING", status: 503 });
    expect(provider.parse).not.toHaveBeenCalled();
  });
});

describe("deterministic zero-cost demo", () => {
  it.each([undefined, "true"])("read-only mode forces demo before any provider call (%s)", async (readOnly) => {
    vi.stubEnv("BRIDGE_PROOF_READ_ONLY", readOnly);
    vi.stubEnv("AI_DEMO_MODE", "false");
    await expect(analyzeEvidence(validEvidence)).resolves.toMatchObject({ analysisMode: "demo" });
    expect(provider.parse).not.toHaveBeenCalled();
  });

  it("produces a repeatable, explicitly labeled fixed fixture", () => {
    const analysis = deterministicAnalysis(validEvidence);
    expect(analysis).toEqual(deterministicAnalysis(validEvidence));
    expect(analysis).toMatchObject({ skill: "REST API Development", level: "Beginner", score: 50 });
    expect(analysis.summary).toContain("not an AI assessment");
  });

  it.each(["development", "production"])("defaults to demo without a provider key in %s", async (environment) => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("NODE_ENV", environment);
    await expect(analyzeEvidence(validEvidence)).resolves.toMatchObject({ analysisMode: "demo" });
    expect(provider.parse).not.toHaveBeenCalled();
  });

  it.each(["development", "production"])("explicit demo mode prevents a provider call with a configured key in %s", async (environment) => {
    vi.stubEnv("AI_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("NODE_ENV", environment);
    await expect(analyzeEvidence(validEvidence)).resolves.toEqual({ analysis: deterministicAnalysis(validEvidence), analysisMode: "demo" });
    expect(provider.parse).not.toHaveBeenCalled();
  });
});
