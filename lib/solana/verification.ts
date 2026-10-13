import { address } from "@solana/kit";
import {
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS, deriveAttestationPda, deriveCredentialPda,
  deriveSchemaPda, deserializeAttestationData, getAttestationDecoder, getCredentialDecoder,
  getSchemaDecoder, serializeAttestationData,
} from "sas-lib";
import { analysisModeSchema, credentialSchema, type VerificationResult } from "../credential";
import {
  CREDENTIAL_NAME, DEVNET_GENESIS_HASH, SCHEMA_FIELD_NAMES_BYTES, SCHEMA_LAYOUT,
  SCHEMA_NAME, SCHEMA_VERSION, attestationDigest, attestationNonce, explorerAddress,
} from "./schema";

export type RawSolanaAccount = { owner: string; executable: boolean; data: Uint8Array };
export type VerificationSnapshot = {
  reference: string;
  genesisHash: string;
  commitment: "processed" | "confirmed" | "finalized";
  authority: string;
  credentialAddress: string;
  schemaAddress: string;
  attestation: RawSolanaAccount | null;
  credential: RawSolanaAccount | null;
  schema: RawSolanaAccount | null;
  now?: Date;
};

function bytesEqual(left: ArrayLike<number>, right: ArrayLike<number>) {
  return Buffer.from(left).equals(Buffer.from(right));
}

/** Pure verifier shared by HTTP reads, CLI verification, and adversarial unit fixtures. */
export async function verifySnapshot(input: VerificationSnapshot): Promise<VerificationResult> {
  const now = input.now ?? new Date();
  const result: VerificationResult = {
    verified: false, network: "devnet", proofType: "sas", attestationAddress: input.reference,
    explorerUrl: explorerAddress(input.reference), checks: [], verifiedAt: now.toISOString(),
  };
  function check(name: string, passed: boolean): asserts passed {
    result.checks.push({ name, passed });
    if (!passed) throw new Error(name);
  }
  try {
    check("RPC is Solana Devnet", input.genesisHash === DEVNET_GENESIS_HASH);
    check("Accounts fetched at confirmed commitment", input.commitment === "confirmed" || input.commitment === "finalized");
    address(input.reference);
    const authority = address(input.authority);
    const credentialAddress = address(input.credentialAddress);
    const schemaAddress = address(input.schemaAddress);
    check("Attestation exists on-chain", input.attestation !== null);
    check("Issuer credential and schema exist on-chain", input.credential !== null && input.schema !== null);
    const accounts = [input.attestation!, input.credential!, input.schema!];
    check("Accounts are owned by the official SAS program", accounts.every((a) => a.owner === SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS && !a.executable));
    // sas-lib's decoders read but do not validate account discriminator bytes.
    check("SAS account discriminators are valid", input.attestation!.data[0] === 2 && input.credential!.data[0] === 0 && input.schema!.data[0] === 1);
    const attestation = getAttestationDecoder().decode(input.attestation!.data);
    const credential = getCredentialDecoder().decode(input.credential!.data);
    const schema = getSchemaDecoder().decode(input.schema!.data);
    const [expectedCredential] = await deriveCredentialPda({ authority, name: CREDENTIAL_NAME });
    const [expectedSchema] = await deriveSchemaPda({ credential: credentialAddress, name: SCHEMA_NAME, version: SCHEMA_VERSION });
    check("Trusted issuer credential and authority", credentialAddress === expectedCredential && credential.authority === authority && new TextDecoder().decode(credential.name) === CREDENTIAL_NAME);
    check("Trusted Bridge Proof schema and version", schemaAddress === expectedSchema && schema.credential === credentialAddress && schema.version === SCHEMA_VERSION && new TextDecoder().decode(schema.name) === SCHEMA_NAME);
    check("Schema layout matches the public credential format", bytesEqual(schema.layout, SCHEMA_LAYOUT) && bytesEqual(schema.fieldNames, SCHEMA_FIELD_NAMES_BYTES));
    check("Schema is active", !schema.isPaused);
    check("Attestation belongs to trusted credential and schema", attestation.credential === credentialAddress && attestation.schema === schemaAddress);
    check("Attestation signer is the trusted authorized issuer", attestation.signer === authority && credential.authorizedSigners.includes(attestation.signer));
    const [expectedAttestation] = await deriveAttestationPda({ credential: credentialAddress, schema: schemaAddress, nonce: attestation.nonce });
    check("Attestation address matches the SAS PDA", expectedAttestation === input.reference);
    check("Attestation has not expired", attestation.expiry > BigInt(Math.floor(now.getTime() / 1000)));
    const data = deserializeAttestationData<Record<string, unknown>>(schema, Uint8Array.from(attestation.data));
    const { credentialHash, analysisMode, ...portable } = data;
    const parsed = credentialSchema.safeParse(portable);
    const mode = analysisModeSchema.safeParse(analysisMode);
    check("On-chain credential structure is valid", parsed.success && mode.success);
    const verifiedCredential = parsed.data!;
    const verifiedMode = mode.data!;
    const { solanaReference, ...draft } = verifiedCredential;
    check("Credential references this attestation", solanaReference === input.reference);
    const issuedTime = Date.parse(verifiedCredential.issuedAt);
    check("Issue date is valid and precedes expiry", issuedTime <= now.getTime() + 5 * 60 * 1000 && BigInt(Math.floor(issuedTime / 1000)) < attestation.expiry);
    check("Credential digest and AI provenance match", typeof credentialHash === "string" && credentialHash === attestationDigest(verifiedCredential, verifiedMode));
    check("Attestation nonce matches credential contents", attestation.nonce === attestationNonce(draft, verifiedMode));
    check("Payload uses canonical encoding", bytesEqual(attestation.data, serializeAttestationData(schema, data)));
    result.credential = verifiedCredential;
    result.analysisMode = verifiedMode;
    result.verified = true;
  } catch (error) {
    result.reason = result.checks.find((c) => !c.passed)?.name || "Malformed attestation or unsupported credential data.";
    if (!result.checks.some((c) => !c.passed)) result.checks.push({ name: "Account data decoded and validated", passed: false });
    // Do not leak raw RPC endpoints, account parser details, or credentials in errors.
    void error;
  }
  return result;
}
