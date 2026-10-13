import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { DEMO_ATTESTATION_ID, isReadOnlyDemo } from "@/lib/deployment";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bridge Proof — Verifiable skills", template: "%s | Bridge Proof" },
  description: "Turn learning evidence into portable skill credentials with AI analysis and verifiable Solana Devnet attestations.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const readOnly = isReadOnlyDemo();
  return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a><SiteHeader readOnly={readOnly} demoCredentialHref={`/credential/${DEMO_ATTESTATION_ID}`} />{children}<footer className="site-footer"><div className="shell footer-inner"><span>Bridge Proof <span className="muted">/ Skills, with evidence.</span></span><div><span className="muted">{readOnly ? "Public read-only demo · Devnet" : "Hackathon MVP · Devnet"}</span><Link href="/verify">Verify a proof ↗</Link></div></div></footer></body></html>;
}
