import { address } from "@solana/kit";
import {
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS, deriveAttestationPda, deriveCredentialPda,
  deriveSchemaPda, getCreateAttestationInstruction, getCredentialDecoder, getSchemaDecoder,
  serializeAttestationData, type Schema,
} from "sas-lib";
import {
  analysisModeSchema, credentialDraftSchema, credentialSchema, type AnalysisMode,
  type CredentialDraft, type SkillCredential, type VerificationResult,
} from "../credential";
import { AppError } from "../errors";
import { createRpc, getPublicSolanaConfig, loadIssuerSigner, type PublicSolanaConfig, type SolanaRpc } from "./config";
import {
  assertDevnet, assertSasProgram, fetchRawAccount, latestSuccessfulSignature,
  readGenesisHash, sendConfirmedInstructions,
} from "./rpc";
import {
  ATTESTATION_TTL_SECONDS, CREDENTIAL_NAME, DEVNET_GENESIS_HASH, SCHEMA_FIELD_NAMES_BYTES,
  SCHEMA_LAYOUT, SCHEMA_NAME, SCHEMA_VERSION, attestationDigest, attestationNonce,
} from "./schema";
import { verifySnapshot } from "./verification";

export { PendingSolanaTransactionError } from "./rpc";

/** Validates the public trust configuration before allowing a write. */
export async function loadTrustedSchema(rpc: SolanaRpc, config: PublicSolanaConfig): Promise<Schema> {
  const [credentialAccount, schemaAccount] = await Promise.all([
    fetchRawAccount(rpc, config.credentialAddress), fetchRawAccount(rpc, config.schemaAddress),
  ]);
  try {
    if (!credentialAccount || !schemaAccount) throw new Error("Missing account");
    if ([credentialAccount, schemaAccount].some((a) => a.owner !== SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS || a.executable)) throw new Error("Invalid account owner");
    if (credentialAccount.data[0] !== 0 || schemaAccount.data[0] !== 1) throw new Error("Invalid discriminator");
    const credential = getCredentialDecoder().decode(credentialAccount.data);
    const schema = getSchemaDecoder().decode(schemaAccount.data);
    const [expectedCredential] = await deriveCredentialPda({ authority: config.authority, name: CREDENTIAL_NAME });
    const [expectedSchema] = await deriveSchemaPda({ credential: config.credentialAddress, name: SCHEMA_NAME, version: SCHEMA_VERSION });
    if (config.credentialAddress !== expectedCredential || config.schemaAddress !== expectedSchema || credential.authority !== config.authority || !credential.authorizedSigners.includes(config.authority)) throw new Error("Untrusted authority");
    if (schema.credential !== config.credentialAddress || schema.version !== SCHEMA_VERSION || schema.isPaused) throw new Error("Invalid schema");
    if (new TextDecoder().decode(credential.name) !== CREDENTIAL_NAME || new TextDecoder().decode(schema.name) !== SCHEMA_NAME) throw new Error("Invalid names");
    if (!Buffer.from(schema.layout).equals(Buffer.from(SCHEMA_LAYOUT)) || !Buffer.from(schema.fieldNames).equals(Buffer.from(SCHEMA_FIELD_NAMES_BYTES))) throw new Error("Invalid schema definition");
    return schema;
  } catch {
    throw new AppError("SAS_CONFIGURATION_INVALID", "The configured SAS credential or schema is missing, paused, or does not match Bridge Proof. Run npm run bootstrap:devnet and check its output.", 503);
  }
}

/** Reads only public chain state. No wallet, API key, database, or in-memory issuance record is used. */
export async function verifyCredential(id: string): Promise<VerificationResult> {
  let reference;
  try { reference = address(id); }
  catch { throw new AppError("INVALID_IDENTIFIER", "Enter a valid Solana attestation account address.", 400); }
  const config = getPublicSolanaConfig();
  const rpc = createRpc();
  const genesisHash = await readGenesisHash(rpc);
  const [attestation, credential, schema] = genesisHash === DEVNET_GENESIS_HASH ? await Promise.all([
    fetchRawAccount(rpc, reference), fetchRawAccount(rpc, config.credentialAddress), fetchRawAccount(rpc, config.schemaAddress),
  ]) : [null, null, null];
  const result = await verifySnapshot({ reference, genesisHash, commitment: "confirmed", ...config, attestation, credential, schema });
  if (result.verified) result.transactionSignature = await latestSuccessfulSignature(rpc, reference);
  return result;
}

export async function issueCredential(input: CredentialDraft, mode: AnalysisMode): Promise<{
  credential: SkillCredential; transactionSignature: string;
}> {
  const draft = credentialDraftSchema.parse(input);
  const analysisMode = analysisModeSchema.parse(mode);
  const config = getPublicSolanaConfig();
  const rpc = createRpc();
  const signer = await loadIssuerSigner();
  if (signer.address !== config.authority) throw new AppError("SOLANA_NOT_CONFIGURED", "The issuer signing key must match the trusted public issuer address.", 503);
  await assertDevnet(rpc);
  const schema = await loadTrustedSchema(rpc, config);
  const nonce = attestationNonce(draft, analysisMode);
  const [reference] = await deriveAttestationPda({ credential: config.credentialAddress, schema: config.schemaAddress, nonce });
  const credential = credentialSchema.parse({ ...draft, solanaReference: reference });
  const existing = await fetchRawAccount(rpc, reference);
  if (existing) {
    const verification = await verifyCredential(reference);
    if (!verification.verified) throw new AppError("ATTESTATION_CONFLICT", "An attestation already exists at this address but did not pass verification.", 409);
    const transactionSignature = verification.transactionSignature;
    if (!transactionSignature) throw new AppError("TRANSACTION_HISTORY_UNAVAILABLE", `The attestation already exists and verifies. Retrieve it by its address: ${reference}`, 503);
    return { credential, transactionSignature };
  }
  await assertSasProgram(rpc);
  const expiry = BigInt(Math.floor(Date.parse(draft.issuedAt) / 1000) + ATTESTATION_TTL_SECONDS);
  if (expiry <= BigInt(Math.floor(Date.now() / 1000))) throw new AppError("CREDENTIAL_EXPIRED", "This credential draft has expired. Analyze the evidence again.", 400);
  const instruction = getCreateAttestationInstruction({
    payer: signer, authority: signer, credential: config.credentialAddress, schema: config.schemaAddress,
    attestation: reference, nonce, expiry,
    data: serializeAttestationData(schema, { ...credential, credentialHash: attestationDigest(credential, analysisMode), analysisMode }),
  });
  const transactionSignature = await sendConfirmedInstructions(rpc, signer, [instruction], reference);
  // The API performs a fresh independent verification before returning a verified success.
  return { credential, transactionSignature };
}
