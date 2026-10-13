import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import IssueForm from "@/components/issue-form";
import { getAnalysisMode } from "@/lib/analysis-mode";
import { DEMO_ATTESTATION_ID, isReadOnlyDemo } from "@/lib/deployment";

export const metadata: Metadata = { title: "Issue a credential" };

export default async function IssuePage() {
  await connection();
  if (isReadOnlyDemo()) {
    return <main id="main" className="shell page-shell"><div className="page-intro"><p className="eyebrow">BRIDGE PROOF · SOLANA DEVNET</p><h1>Public read-only demo</h1><p>Explore the existing credential and independently check its on-chain record.</p></div><section className="panel"><h2>Issuance is disabled.</h2><p>This public demo does not accept evidence or create new credentials. The existing credential uses deterministic demo analysis; its Solana Devnet attestation is real.</p><div className="button-row"><Link className="button button-primary" href={`/credential/${DEMO_ATTESTATION_ID}`}>View verified credential</Link><Link className="button button-secondary" href="/verify">Verify a credential</Link></div></section></main>;
  }
  return <IssueForm analysisMode={getAnalysisMode()} />;
}
