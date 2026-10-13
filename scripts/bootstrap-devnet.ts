import {
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS, deriveCredentialPda, deriveSchemaPda,
  getCreateCredentialInstruction, getCreateSchemaInstruction, getCredentialDecoder,
} from "sas-lib";
import { AppError } from "../lib/errors";
import { createRpc, loadIssuerSigner } from "../lib/solana/config";
import { loadTrustedSchema } from "../lib/solana";
import { assertDevnet, assertSasProgram, fetchRawAccount, sendConfirmedInstructions, PendingSolanaTransactionError } from "../lib/solana/rpc";
import { CREDENTIAL_NAME, SCHEMA_DESCRIPTION, SCHEMA_FIELDS, SCHEMA_LAYOUT, SCHEMA_NAME, SCHEMA_VERSION } from "../lib/solana/schema";

async function main() {
  const rpc = createRpc();
  await assertDevnet(rpc);
  await assertSasProgram(rpc);
  console.log(`Confirmed Solana Devnet and executable official SAS program: ${SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS}`);
  if (process.argv.includes("--check")) {
    console.log("Read-only network check passed. No keypair loaded and no transaction sent.");
    return;
  }
  const signer = await loadIssuerSigner();
  const [credentialAddress] = await deriveCredentialPda({ authority: signer.address, name: CREDENTIAL_NAME });
  const [schemaAddress] = await deriveSchemaPda({ credential: credentialAddress, name: SCHEMA_NAME, version: SCHEMA_VERSION });
  for (const [name, expected] of [["SAS_CREDENTIAL_ADDRESS", credentialAddress], ["SAS_SCHEMA_ADDRESS", schemaAddress]]) {
    if (process.env[name] && process.env[name]?.trim() !== expected) throw new AppError("SAS_CONFIGURATION_INVALID", `${name} does not match this issuer. Check your configured public addresses before bootstrap.`, 503);
  }
  const { value: balance } = await rpc.getBalance(signer.address, { commitment: "confirmed" }).send({ abortSignal: AbortSignal.timeout(10_000) });
  console.log(`Issuer: ${signer.address}`);
  console.log(`Devnet balance: ${Number(balance) / 1_000_000_000} SOL`);
  const credential = await fetchRawAccount(rpc, credentialAddress);
  if (!credential) {
    if (balance < 10_000_000n) throw new AppError("DEVNET_FUNDING_REQUIRED", `Fund issuer ${signer.address} with at least 0.01 Devnet SOL at https://faucet.solana.com, then rerun bootstrap.`, 503);
    const signature = await sendConfirmedInstructions(rpc, signer, [getCreateCredentialInstruction({
      payer: signer, authority: signer, credential: credentialAddress, name: CREDENTIAL_NAME, signers: [signer.address],
    })], credentialAddress);
    console.log(`Credential created: ${credentialAddress}`);
    console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  } else {
    if (credential.owner !== SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS || credential.executable || credential.data[0] !== 0) throw new AppError("SAS_CONFIGURATION_INVALID", "The existing credential account has an unexpected owner or type.", 503);
    const state = getCredentialDecoder().decode(credential.data);
    if (state.authority !== signer.address || !state.authorizedSigners.includes(signer.address) || new TextDecoder().decode(state.name) !== CREDENTIAL_NAME) throw new AppError("SAS_CONFIGURATION_INVALID", "The existing credential does not authorize this issuer. Restore its authorization before continuing.", 503);
    console.log(`Using existing credential: ${credentialAddress}`);
  }
  if (!await fetchRawAccount(rpc, schemaAddress)) {
    const signature = await sendConfirmedInstructions(rpc, signer, [getCreateSchemaInstruction({
      payer: signer, authority: signer, credential: credentialAddress, schema: schemaAddress,
      name: SCHEMA_NAME, description: SCHEMA_DESCRIPTION, fieldNames: [...SCHEMA_FIELDS], layout: SCHEMA_LAYOUT,
    })], schemaAddress);
    console.log(`Schema created: ${schemaAddress}`);
    console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  } else {
    console.log(`Using existing schema: ${schemaAddress}`);
  }
  await loadTrustedSchema(rpc, { authority: signer.address, credentialAddress, schemaAddress });
  console.log("Bootstrap complete. Add these PUBLIC values to .env.local and your deployment environment:");
  console.log(`SOLANA_ISSUER_PUBLIC_KEY=${signer.address}`);
  console.log(`SAS_CREDENTIAL_ADDRESS=${credentialAddress}`);
  console.log(`SAS_SCHEMA_ADDRESS=${schemaAddress}`);
  console.log("Keep the issuer keypair private. This script never writes or prints private keys.");
}

main().catch((error: unknown) => {
  if (error instanceof PendingSolanaTransactionError) {
    console.error(error.message);
    console.error(`Account: ${error.reference}`);
    console.error(`Transaction: https://explorer.solana.com/tx/${error.transactionSignature}?cluster=devnet`);
  } else {
    console.error(error instanceof AppError ? `${error.code}: ${error.message}` : "Bootstrap failed. Check the Devnet RPC, issuer funding, and SAS configuration.");
  }
  process.exitCode = 1;
});
