"use client";

import { useState, type FormEvent } from "react";
import { ProofViewer } from "@/components/proof-viewer";
import { ArrowIcon } from "@/components/icons";

export default function VerifyPage() {
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState<{ id: string; attempt: number } | null>(null);
  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (address.trim()) setQuery((value) => ({ id: address.trim(), attempt: (value?.attempt ?? 0) + 1 }));
  }
  return <main id="main" className="shell page-shell"><div className="page-intro"><p className="eyebrow">TRUST THE RECORD. CHECK THE PROOF.</p><h1>Verify a credential.</h1><p>Fetch an attestation directly from Solana Devnet and check its integrity.</p></div><form className="panel verify-form" onSubmit={verify}><label htmlFor="attestation-address">Solana attestation address</label><div className="verify-input-row"><input id="attestation-address" name="address" value={address} onChange={(event) => setAddress(event.target.value)} required maxLength={100} spellCheck={false} autoComplete="off" placeholder="Paste the attestation address" aria-describedby="verify-help" /><button className="button button-primary" type="submit">Verify credential <ArrowIcon /></button></div><p className="field-help" id="verify-help">Use the attestation address shown on a Bridge Proof credential. Every check reads the on-chain record; no saved credential or wallet is needed.</p></form>{query ? <ProofViewer key={query.attempt} id={query.id} /> : <div className="verify-empty"><span className="empty-mark">↗</span><h2>A proof should be checkable.</h2><p>Verification checks the Solana account, credential schema, issuer, and data integrity. A green status appears only when all required checks pass.</p><div className="empty-checks"><span>On-chain record</span><span>Trusted issuer</span><span>Credential integrity</span></div></div>}</main>;
}
