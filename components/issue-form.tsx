"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowIcon, ShieldIcon } from "@/components/icons";
import type { AnalysisMode, SkillCredential } from "@/lib/credential";

type AnalysisResponse = {
  analysis: { skill: string; level: string; score: number; summary: string; rationale: string };
  analysisMode: "openai" | "demo";
  credential: Omit<SkillCredential, "solanaReference">;
  issuanceToken: string;
  expiresAt: string;
};

const SAMPLE_EVIDENCE = "I built a task management REST API using TypeScript, Node.js, and PostgreSQL. I implemented endpoints to create, retrieve, update, and delete tasks, with request validation and consistent HTTP status codes. I added JWT authentication and checked that users can only access their own tasks. I used parameterized queries to protect against SQL injection, database migrations for reproducible setup, and pagination for the task listing endpoint. I wrote integration tests for successful requests, invalid input, unauthorized access, and missing resources. I documented the endpoints with example requests and deployed the project to a test environment. One challenge was keeping error responses consistent; I solved it with a shared error handler. I still want to improve rate limiting, monitoring, and performance testing under concurrent traffic.";

export default function IssueForm({ analysisMode }: { analysisMode: AnalysisMode }) {
  const isDemo = analysisMode === "demo";
  const router = useRouter();
  const [evidence, setEvidence] = useState("");
  const [skillContext, setSkillContext] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"analyze" | "issue" | null>(null);
  const [error, setError] = useState("");
  const [pendingReference, setPendingReference] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: "center" });
    }
  }, [error]);
  useEffect(() => {
    if (result) {
      previewRef.current?.focus();
      previewRef.current?.scrollIntoView({ block: "start" });
    }
  }, [result]);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setPendingReference(""); setBusy("analyze");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidence, ...(skillContext.trim() ? { skillContext: skillContext.trim() } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Analysis could not be completed. Please try again.");
      setResult(data); setConsent(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reach the analysis service."); }
    finally { setBusy(null); }
  }

  async function issue() {
    if (!result || !consent || busy) return;
    setError(""); setPendingReference(""); setBusy("issue");
    try {
      const response = await fetch("/api/credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issuanceToken: result.issuanceToken }) });
      const data = await response.json();
      if (!response.ok) {
        if (typeof data.reference === "string") setPendingReference(data.reference);
        throw new Error(data.error?.message || "Issuance could not be completed. Please try again.");
      }
      if (!data.credential?.solanaReference) throw new Error("The service did not return an attestation address. Please check the server configuration.");
      router.push(`/credential/${encodeURIComponent(data.credential.solanaReference)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reach the issuance service."); setBusy(null); }
  }

  function editEvidence() { setResult(null); setConsent(false); setError(""); setPendingReference(""); }

  return <main id="main" className="shell page-shell"><div className="page-intro"><p className="eyebrow">CREATE A SKILL CREDENTIAL</p><h1>Turn your work into proof.</h1><p>Start with evidence. Review the analysis. Issue a verifiable record.</p></div>
    <ol className="flow-steps" aria-label="Issuance progress"><li className={!result ? "current" : "complete"} aria-current={!result ? "step" : undefined}><span>1</span>Submit evidence</li><li className={result ? "current" : ""} aria-current={result ? "step" : undefined}><span>2</span>Review & issue</li><li><span>3</span>Verify on Solana</li></ol>
    <div className="workspace-grid"><div>
      {!result && isDemo && <div className="notice notice-warning"><strong>Demo analysis · no paid AI calls</strong><p>This demo uses deterministic rules and a fixed level and score. Your evidence is processed by this app and is not sent to OpenAI. Issuance still creates a real Solana Devnet attestation.</p></div>}
      {error && <div className="notice notice-error" role="alert" ref={errorRef} tabIndex={-1}><strong>{pendingReference ? "Issuance needs verification" : "We could not complete this step"}</strong><p>{error}</p>{pendingReference && <Link className="text-link" href={`/credential/${encodeURIComponent(pendingReference)}`}>Check the submitted attestation <ArrowIcon /></Link>}</div>}
      {!result ? <form className="panel evidence-form" onSubmit={analyze}><div className="panel-heading"><div><span className="eyebrow">STEP 01</span><h2>What have you built or learned?</h2></div><button className="text-button" type="button" disabled={!!busy} onClick={() => { setEvidence(SAMPLE_EVIDENCE); setSkillContext("REST API Development"); setError(""); }}>Use sample evidence</button></div><label htmlFor="evidence">Learning evidence <span className="required-mark">*</span></label><p className="field-help" id="evidence-help">Include what you did, how you did it, and what you learned. Concrete details make the analysis more useful.</p><textarea id="evidence" name="evidence" rows={10} minLength={50} maxLength={20000} required value={evidence} onChange={(event) => setEvidence(event.target.value)} disabled={!!busy} aria-describedby="evidence-help evidence-count" placeholder="I built a REST API for a task management application. I implemented…" /><div className="input-meta" id="evidence-count"><span>50–20,000 characters</span><span>{evidence.length.toLocaleString()} / 20,000</span></div><label htmlFor="skill-context">Skill context <span className="optional">optional</span></label><input id="skill-context" name="skillContext" maxLength={300} value={skillContext} onChange={(event) => setSkillContext(event.target.value)} disabled={!!busy} placeholder="e.g. REST API Development" /><p className="field-help">A skill or topic you would like the analysis to focus on.</p><div className="form-footer"><p>{isDemo ? "Evidence is processed by this app without paid AI. Please remove personal or confidential information." : "Evidence is sent to the analysis service. Please remove personal or confidential information."}</p><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "analyze" ? (isDemo ? "Generating demo analysis…" : "Analyzing evidence…") : (isDemo ? "Generate demo analysis" : "Analyze evidence")}{!busy && <ArrowIcon />}</button></div><span className="sr-only" role="status">{busy === "analyze" ? (isDemo ? "Generating the deterministic demo. Please wait." : "Analyzing your evidence. Please wait.") : ""}</span></form>
      : <section className="panel preview-panel" aria-labelledby="preview-title" ref={previewRef} tabIndex={-1}><div className="panel-heading"><div><span className="eyebrow">STEP 02</span><h2 id="preview-title">Review your credential</h2></div><span className={`mode-pill${result.analysisMode === "demo" ? " mode-demo" : ""}`}>{result.analysisMode === "demo" ? "Deterministic demo" : "OpenAI analysis"}</span></div>{result.analysisMode === "demo" && <div className="notice notice-warning"><strong>Demo analysis — no OpenAI call was made.</strong><p>This is a deterministic example for testing. If issued, its Solana attestation is real and remains labeled as a demo.</p></div>}<div className="preview-skill"><div><span className="field-label">Proposed skill</span><h3>{result.analysis.skill}</h3><span className="level-pill">{result.analysis.level}</span></div><div className="score-block"><span className="field-label">{result.analysisMode === "demo" ? "Demo score" : "AI score"}</span><strong>{result.analysis.score}<span>%</span></strong></div></div><div className="analysis-prose"><h3>Summary</h3><p>{result.analysis.summary}</p><h3>Why this assessment</h3><p>{result.analysis.rationale}</p></div><div className="public-fields"><h3>Public credential fields</h3><p className="field-help">The following fields will be publicly readable on Solana. The attestation address is added after issuance.</p><dl className="compact-details"><div><dt>Skill</dt><dd>{result.credential.skill}</dd></div><div><dt>Level / score</dt><dd>{result.credential.level} / {result.credential.score}%</dd></div><div><dt>Subject hash</dt><dd className="mono break-word">{result.credential.subjectHash}</dd></div><div><dt>Evidence hash</dt><dd className="mono break-word">{result.credential.evidenceHash}</dd></div><div><dt>Issuer</dt><dd>{result.credential.issuer}</dd></div><div><dt>Issue date</dt><dd>{new Date(result.credential.issuedAt).toLocaleString()}</dd></div><div><dt>Version</dt><dd>{result.credential.version}</dd></div><div><dt>Analysis mode</dt><dd>{result.analysisMode === "demo" ? "Demo (deterministic)" : "OpenAI"}</dd></div></dl></div><label className="consent-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={!!busy} /><span>I have reviewed these fields and confirm they contain no personal or sensitive information. I understand issuance creates a public, persistent Devnet record.</span></label><div className="preview-actions"><button className="button button-secondary" type="button" disabled={!!busy} onClick={editEvidence}>Edit evidence</button><button className="button button-primary" type="button" disabled={!consent || !!busy} onClick={issue}>{busy === "issue" ? "Issuing on Solana…" : "Issue on Solana Devnet"}{!busy && <ArrowIcon />}</button></div><p className="field-help token-expiry">Preview expires {new Date(result.expiresAt).toLocaleTimeString()}. After expiry, analyze the evidence again.</p><span className="sr-only" role="status">{busy === "issue" ? "Submitting your attestation to Solana Devnet. Please wait." : ""}</span></section>}
    </div><aside className="aside-stack"><div className="aside-note"><ShieldIcon /><h3>Your evidence stays off-chain.</h3><p>The public credential stores a SHA-256 hash of your evidence. Raw evidence, summaries, and analysis rationale are not written to Solana.</p></div><div className="aside-note bordered"><span className="eyebrow">WHAT A PROOF MEANS</span><h3>A verifiable record of an assessment.</h3><p>Solana verification checks that the credential was issued by the configured Bridge Proof issuer and has not changed.</p><p>{isDemo ? "Demo analysis uses fixed assessment values to exercise the credential flow. It does not evaluate competence or establish identity or authorship." : "AI analysis is an assessment of submitted text. It does not establish identity, authorship, or independently validated competence."}</p></div><div className="small-note"><span className="status-dot" /><p>This MVP runs on Solana Devnet. The server funds issuance; you do not need a wallet.</p></div></aside></div>
  </main>;
}
