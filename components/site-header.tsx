"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BridgeMark } from "./icons";

export function SiteHeader({ readOnly, demoCredentialHref }: { readOnly: boolean; demoCredentialHref: string }) {
  const pathname = usePathname();
  const primaryHref = readOnly ? demoCredentialHref : "/issue";
  return <header className="site-header"><div className="shell header-inner">
    <Link className="brand" href="/" aria-label="Bridge Proof home"><BridgeMark small /><span>bridge<span className="brand-light">proof</span></span></Link>
    <nav aria-label="Main navigation"><Link href={primaryHref} className={pathname === primaryHref ? "nav-link active" : "nav-link"} aria-current={pathname === primaryHref ? "page" : undefined}>{readOnly ? "View demo proof" : "Issue a credential"}</Link><Link href="/verify" className={pathname === "/verify" ? "nav-link active" : "nav-link"} aria-current={pathname === "/verify" ? "page" : undefined}>Verify</Link></nav>
    <span className="network-pill"><span className="status-dot" />Solana Devnet</span>
  </div></header>;
}
