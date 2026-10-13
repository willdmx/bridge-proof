import { describe, expect, it } from "vitest";
import { getAddressDecoder } from "@solana/kit";
import {
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS, deriveAttestationPda, deriveCredentialPda,
  deriveSchemaPda, getAttestationEncoder, getCredentialEncoder, getSchemaEncoder,
  serializeAttestationData, type AttestationArgs, type Credential, type Schema,
} from "sas-lib";
import { verifySnapshot, type RawSolanaAccount, type VerificationSnapshot } from "../lib/solana/verification";
import {
  CREDENTIAL_NAME, DEVNET_GENESIS_HASH, SCHEMA_FIELD_NAMES_BYTES, SCHEMA_LAYOUT,
  SCHEMA_NAME, SCHEMA_VERSION, attestationDigest, attestationNonce,
} from "../lib/solana/schema";
import { validDraft } from "./fixtures";

const authority = getAddressDecoder().decode(new Uint8Array(32).fill(1));
const otherAuthority = getAddressDecoder().decode(new Uint8Array(32).fill(2));
const now = new Date("2026-10-11T12:05:00.000Z");
function raw(data: ArrayLike<number>): RawSolanaAccount {
  return { owner: SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS, executable: false, data: Uint8Array.from(data) };
}

/** Encoded fixture accounts exercise the actual SAS codecs and PDA checks, without RPC. */
async function fixture() {
  const [credentialAddress] = await deriveCredentialPda({ authority, name: CREDENTIAL_NAME });
  const [schemaAddress] = await deriveSchemaPda({ credential: credentialAddress, name: SCHEMA_NAME, version: SCHEMA_VERSION });
  const nonce = attestationNonce(validDraft, "openai");
  const [reference] = await deriveAttestationPda({ credential: credentialAddress, schema: schemaAddress, nonce });
  const portable = { ...validDraft, solanaReference: reference };
  const payload = { ...portable, credentialHash: attestationDigest(portable, "openai"), analysisMode: "openai" };
  const credential: Credential = {
    discriminator: 0, authority, name: new TextEncoder().encode(CREDENTIAL_NAME), authorizedSigners: [authority],
  };
  const schema: Schema = {
    discriminator: 1, credential: credentialAddress, name: new TextEncoder().encode(SCHEMA_NAME),
    description: new TextEncoder().encode("Unit test fixture"), layout: SCHEMA_LAYOUT,
    fieldNames: SCHEMA_FIELD_NAMES_BYTES, isPaused: false, version: SCHEMA_VERSION,
  };
  const attestation: AttestationArgs = {
    discriminator: 2, nonce, credential: credentialAddress, schema: schemaAddress,
    data: serializeAttestationData(schema, payload), signer: authority,
    expiry: BigInt(Math.floor(now.getTime() / 1000) + 3600), tokenAccount: authority,
  };
  const snapshot: VerificationSnapshot = {
    reference, genesisHash: DEVNET_GENESIS_HASH, commitment: "confirmed", authority,
    credentialAddress, schemaAddress, attestation: raw(getAttestationEncoder().encode(attestation)),
    credential: raw(getCredentialEncoder().encode(credential)), schema: raw(getSchemaEncoder().encode(schema)), now,
  };
  return { snapshot, attestation, credential, schema, payload, portable };
}

describe("independent Solana attestation verification", () => {
  it("accepts correctly encoded, trusted, confirmed SAS accounts", async () => {
    const f = await fixture();
    const result = await verifySnapshot(f.snapshot);
    expect(result.reason).toBeUndefined();
    expect(result.verified).toBe(true);
    expect(result.credential).toEqual(f.portable);
    expect(result.analysisMode).toBe("openai");
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.explorerUrl).toContain("cluster=devnet");
  });

  it("accepts finalized accounts but rejects processed-only state", async () => {
    const { snapshot } = await fixture();
    expect((await verifySnapshot({ ...snapshot, commitment: "finalized" })).verified).toBe(true);
    const unconfirmed = await verifySnapshot({ ...snapshot, commitment: "processed" });
    expect(unconfirmed.verified).toBe(false);
    expect(unconfirmed.reason).toContain("confirmed commitment");
  });

  it("rejects another network even if the payload is otherwise valid", async () => {
    const { snapshot } = await fixture();
    const result = await verifySnapshot({ ...snapshot, genesisHash: "mainnet-or-local-validator" });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("RPC is Solana Devnet");
  });

  it.each(["attestation", "credential", "schema"] as const)("rejects a missing %s account", async (name) => {
    const { snapshot } = await fixture();
    expect((await verifySnapshot({ ...snapshot, [name]: null })).verified).toBe(false);
  });

  it.each(["attestation", "credential", "schema"] as const)("rejects a %s owned by another program", async (name) => {
    const { snapshot } = await fixture();
    const result = await verifySnapshot({ ...snapshot, [name]: { ...snapshot[name]!, owner: otherAuthority } });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("official SAS program");
  });

  it("rejects executable accounts and incorrect account discriminators", async () => {
    const { snapshot } = await fixture();
    expect((await verifySnapshot({ ...snapshot, attestation: { ...snapshot.attestation!, executable: true } })).verified).toBe(false);
    const data = Uint8Array.from(snapshot.attestation!.data);
    data[0] = 9;
    const result = await verifySnapshot({ ...snapshot, attestation: raw(data) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("discriminators");
  });

  it("rejects the wrong trusted issuer configuration", async () => {
    const { snapshot } = await fixture();
    const result = await verifySnapshot({ ...snapshot, authority: otherAuthority });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("issuer credential and authority");
  });

  it("rejects a signer who is not the configured authority", async () => {
    const f = await fixture();
    const result = await verifySnapshot({ ...f.snapshot, attestation: raw(getAttestationEncoder().encode({ ...f.attestation, signer: otherAuthority })) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("trusted authorized issuer");
  });

  it("rejects a removed authorized signer", async () => {
    const f = await fixture();
    const result = await verifySnapshot({ ...f.snapshot, credential: raw(getCredentialEncoder().encode({ ...f.credential, authorizedSigners: [] })) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("trusted authorized issuer");
  });

  it("rejects an attestation that references a different schema", async () => {
    const f = await fixture();
    const result = await verifySnapshot({ ...f.snapshot, attestation: raw(getAttestationEncoder().encode({ ...f.attestation, schema: otherAuthority })) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("trusted credential and schema");
  });

  it("rejects a paused schema, unexpected version, or changed field layout", async () => {
    const f = await fixture();
    for (const patch of [{ isPaused: true }, { version: 2 }, { layout: new Uint8Array([12]) }]) {
      const result = await verifySnapshot({ ...f.snapshot, schema: raw(getSchemaEncoder().encode({ ...f.schema, ...patch })) });
      expect(result.verified).toBe(false);
    }
  });

  it("rejects an account address that is not the derived attestation PDA", async () => {
    const { snapshot } = await fixture();
    const result = await verifySnapshot({ ...snapshot, reference: otherAuthority });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("matches the SAS PDA");
  });

  it("rejects an expired attestation at the expiry boundary", async () => {
    const f = await fixture();
    const result = await verifySnapshot({ ...f.snapshot, attestation: raw(getAttestationEncoder().encode({ ...f.attestation, expiry: BigInt(Math.floor(now.getTime() / 1000)) })) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("has not expired");
  });

  it.each([{ score: 100 }, { evidenceHash: "c".repeat(64) }, { analysisMode: "demo" }])("rejects tampered credential data or provenance %#", async (patch) => {
    const f = await fixture();
    const data = serializeAttestationData(f.schema, { ...f.payload, ...patch });
    const result = await verifySnapshot({ ...f.snapshot, attestation: raw(getAttestationEncoder().encode({ ...f.attestation, data })) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("digest and AI provenance");
    expect(result.credential).toBeUndefined();
  });

  it("still rejects edited content when its digest is recomputed", async () => {
    const f = await fixture();
    const portable = { ...f.portable, score: 100 };
    const data = serializeAttestationData(f.schema, { ...portable, credentialHash: attestationDigest(portable, "openai"), analysisMode: "openai" });
    const result = await verifySnapshot({ ...f.snapshot, attestation: raw(getAttestationEncoder().encode({ ...f.attestation, data })) });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("nonce matches credential contents");
  });

  it("returns a safe unverified result for malformed account bytes", async () => {
    const { snapshot } = await fixture();
    const result = await verifySnapshot({ ...snapshot, attestation: raw(Uint8Array.of(2)) });
    expect(result.verified).toBe(false);
    expect(result.credential).toBeUndefined();
    expect(result.checks.some((check) => !check.passed)).toBe(true);
  });
});
