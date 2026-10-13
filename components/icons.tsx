import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ArrowIcon(props: IconProps) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

export function ShieldIcon(props: IconProps) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" {...props}><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></svg>;
}

export function ExternalIcon(props: IconProps) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}><path d="M14 3h7v7m0-7L10 14m10 0v7H3V4h7" /></svg>;
}

export function BridgeMark({ small = false }: { small?: boolean }) {
  return <span className={`bridge-mark${small ? " bridge-mark-small" : ""}`} aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 19V7h5v5h4V7h5v12M5 14h14M9 7V4m6 3V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" /></svg></span>;
}
