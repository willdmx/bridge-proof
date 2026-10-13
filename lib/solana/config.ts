import { readFile } from "node:fs/promises";
import { address, createKeyPairSignerFromBytes, createSolanaRpc, type Address } from "@solana/kit";
import { AppError } from "../errors";

export type PublicSolanaConfig = {
  authority: Address;
  credentialAddress: Address;
  schemaAddress: Address;
};

function configuredAddress(name: string): Address {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError("SOLANA_NOT_CONFIGURED", `Set ${name} using the output of npm run bootstrap:devnet.`, 503);
  try { return address(value); }
  catch { throw new AppError("SOLANA_NOT_CONFIGURED", `${name} must be a valid Solana public address.`, 503); }
}

export function getPublicSolanaConfig(): PublicSolanaConfig {
  return {
    authority: configuredAddress("SOLANA_ISSUER_PUBLIC_KEY"),
    credentialAddress: configuredAddress("SAS_CREDENTIAL_ADDRESS"),
    schemaAddress: configuredAddress("SAS_SCHEMA_ADDRESS"),
  };
}

export function createRpc() {
  const endpoint = process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    return createSolanaRpc(endpoint);
  } catch {
    throw new AppError("SOLANA_NOT_CONFIGURED", "SOLANA_RPC_URL must be an HTTPS Solana Devnet RPC endpoint.", 503);
  }
}
export type SolanaRpc = ReturnType<typeof createRpc>;

/** Server-only wallet loader. Never logs secrets or includes them in errors. */
export async function loadIssuerSigner() {
  const secret = process.env.SOLANA_ISSUER_SECRET_KEY;
  const path = process.env.SOLANA_ISSUER_KEYPAIR_PATH;
  if (secret && path) throw new AppError("SOLANA_NOT_CONFIGURED", "Configure only one of SOLANA_ISSUER_SECRET_KEY and SOLANA_ISSUER_KEYPAIR_PATH.", 503);
  if (!secret && !path) throw new AppError("SOLANA_NOT_CONFIGURED", "Set SOLANA_ISSUER_SECRET_KEY or SOLANA_ISSUER_KEYPAIR_PATH to a funded Devnet issuer keypair.", 503);
  try {
    const parsed: unknown = JSON.parse(secret || await readFile(path!, "utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 64 || !parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) throw new Error("Invalid keypair");
    const signer = await createKeyPairSignerFromBytes(Uint8Array.from(parsed));
    const expected = process.env.SOLANA_ISSUER_PUBLIC_KEY?.trim();
    if (expected && signer.address !== expected) throw new AppError("SOLANA_NOT_CONFIGURED", "The issuer keypair does not match SOLANA_ISSUER_PUBLIC_KEY.", 503);
    return signer;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("SOLANA_NOT_CONFIGURED", "The issuer keypair must be a valid 64-byte Solana CLI JSON keypair; check the configured secret or file.", 503);
  }
}
