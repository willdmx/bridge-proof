import { ProofViewer } from "@/components/proof-viewer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify skill credential" };

export default async function CredentialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main id="main" className="shell page-shell"><div className="page-intro"><p className="eyebrow">EVIDENCE, MADE PORTABLE</p><h1>Your skill. An open record.</h1><p>A credential with a verifiable connection to its evidence.</p></div><ProofViewer id={id} endpoint="credentials" /></main>;
}
