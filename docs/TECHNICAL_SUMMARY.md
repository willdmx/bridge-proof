# Bridge Proof — technical summary

Bridge Proof is a Next.js App Router and TypeScript application that turns evidence into structured skill credentials, issues official Solana Attestation Service records on Devnet using `sas-lib`, and retrieves/verifies them without a database.

## Demo configuration

The public submission is read-only: `BRIDGE_PROOF_READ_ONLY=true` and `AI_DEMO_MODE=true`. Read-only mode is the fail-closed default whenever the first setting is absent or anything other than exactly `false`. Both POST APIs return `403 READ_ONLY_DEMO` before reading input, handling tokens, calling a provider, or signing. Public verification remains available.

The Vercel deployment contains only the public issuer/credential/schema addresses, an optional Devnet RPC endpoint, and those mode flags. It must contain no issuer wallet/keypair, `CREDENTIAL_SIGNING_SECRET`, or `OPENAI_API_KEY`. Read-only mode forces demo analysis configuration even if other AI settings are changed.

The existing proof was issued locally from a deterministic assessment: a keyword classifier selected a generic skill and returned a fixed Beginner/50 assessment with no OpenAI request. Local issuance can be explicitly enabled with `BRIDGE_PROOF_READ_ONLY=false`; it is not part of the public walkthrough.

The optional OpenAI integration uses the official Node SDK, Responses API, a model from `OPENAI_MODEL`, and strict structured output validated with Zod. It is not exercised by the zero-cost demonstration. No real AI result should be inferred from a demo credential.

## Local issuance and public verification

Steps 1–3 below describe the completed local issuance workflow and are disabled in the public deployment. Steps 4–5 remain public.

1. `POST /api/analyze` validates bounded evidence and optional context, produces a labeled assessment, hashes the exact evidence bytes, and creates a random pseudonymous subject handle.
2. A 15-minute HMAC token authenticates the credential draft and its `analysisMode` so the browser cannot change the score or relabel a demo assessment as OpenAI.
3. `POST /api/credentials` verifies the token, derives the SAS attestation address, submits a real Devnet transaction, and fetches the resulting account independently.
4. `GET /api/credentials/[id]` and `GET /api/verify/[id]` retrieve public chain state and return a verified credential only after all checks pass.
5. `GET /api/config` exposes public assessment mode, read-only status, network, and proof type without returning secrets.

## On-chain design

```text
Issuer authority → BRIDGE_PROOF credential
                 → BRIDGE_PROOF_SKILL_V1 schema
                 → individual attestation
```

The public payload contains subject/evidence hashes, a generic skill category, level, score, issuer, issue time, version, attestation reference, a canonical credential digest, and assessment mode. Raw evidence, free-form context, summary, rationale, names, emails, and private documents are excluded. A hash is a commitment, not encryption or an identity claim.

Deterministic nonces make retries of the same signed draft resolve to the same account. Attestations expire one year after the draft's issue time. Pending confirmation returns an unverified state and recovery identifiers instead of claiming success.

## Verification boundary

The verifier requires Devnet's genesis hash and confirmed or finalized account state; official SAS account ownership and discriminator bytes; expected issuer/schema addresses, fields, version, and active state; authorized issuer signing; the correct attestation address; unexpired data; valid credential structure; canonical encoding; and matching credential digest, nonce, and assessment provenance.

`verified: true` authenticates the public record and configured issuer. It does not verify identity, evidence authorship, or real-world competence. Evidence integrity means its hash is authenticated within that record; an exact copy of the source text can be hashed separately for comparison.

## Validation and operating limits

Unit tests mock external providers and exercise real SAS codecs against encoded fixtures, including tampering, wrong issuer/schema/owner/network, invalid finality, expiry, malformed data, and pending API results. They also check that default/explicit read-only mode rejects both POST routes before input parsing or provider/signing work, even with a valid signed issuance token, and that public configuration discloses no secrets. Local tests are separate from live chain verification.

On **October 13, 2026**, `npm run smoke:devnet` completed demo assessment, real SAS issuance, both read APIs, and 20/20 verification checks. The independent CLI verifier also returned verified. No OpenAI request or digest-only fallback was used. The [public receipt](devnet-proof.json) contains the credential, transaction signature, authenticated demo provenance, and successful checks; [synthetic evidence](demo-evidence.txt) supports an exact hash comparison.

- [Devnet attestation `7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P`](https://explorer.solana.com/address/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P?cluster=devnet)
- [Issuance transaction](https://explorer.solana.com/tx/4nbKAbv3t6bNGTkrcEBBMVLC5YRzKppTVrAcKG84R7CnmAgkBeayicpxW6bYaKUueR8Bd3oKQoLx8KA4WHQdBqCN?cluster=devnet)

The issuance smoke command requires an explicitly enabled local write workflow and cannot issue through the public deployment. Re-run read-only independent verification with `npm run verify:devnet -- 7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P`. The public walkthrough retrieves this proof, inspects its Explorer record, verifies it in a fresh session, and compares the exact synthetic evidence hash.

The local Devnet wallet is hackathon infrastructure, not production custody. It is never deployed. The public application has no write operations or authentication; hosting limits still matter for public RPC-read traffic. There is no custom on-chain program, NFT, token, payment flow, or database.

## Hackathon disclosure

Bridge, the underlying AI-first education startup, existed before September 14, including its broader product vision and prior API experimentation.

Bridge Proof itself, its repository, Solana integration, verifiable credential architecture and hackathon MVP are being developed during this hackathon.
