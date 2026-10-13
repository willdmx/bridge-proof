# Bridge Proof

**AI-native infrastructure for verifiable skills.**

Bridge Proof turns learning evidence into a portable skill credential, records it through the official Solana Attestation Service (SAS) on Devnet, and verifies the result from public chain state. It is a solo-founder hackathon MVP for the Colosseum Crypto World's Fair 2026. The submission demo uses a clearly labeled, deterministic assessment with no OpenAI calls; real OpenAI integration remains optional.

**The public deployment is read-only.** Visitors can inspect and independently verify the real Devnet credential below and compare its evidence hash. Both write APIs return `403 READ_ONLY_DEMO` before parsing input, creating a preview, calling AI, or signing a transaction. No wallet private key, OpenAI key, or credential-signing secret belongs in the public deployment.

**Live demo:** [bridge-proof.vercel.app](https://bridge-proof.vercel.app) · [Verified credential](https://bridge-proof.vercel.app/credential/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P) · [Independent verification result](https://bridge-proof.vercel.app/api/verify/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P)

The public deployment passed anonymous page/API checks on October 13, 2026. Both proof APIs returned 20/20 successful verification checks, and both write APIs returned HTTP 403. Solana Explorer rate-limited automated link checks (HTTP 429); the application's verification reads Devnet RPC directly and succeeded independently of Explorer.

```text
Learning evidence → Labeled demo assessment → Structured credential
                 → Solana Devnet attestation → Independent verification → VERIFIED
```

## Implementation and validation status

The zero-cost demo completed real SAS issuance, fresh API retrieval, and independent CLI verification on **October 13, 2026**. All 20 on-chain verification checks passed. The assessment was explicitly `demo`; no OpenAI call was made. The official SAS integration worked, so no digest-only fallback was used. The current automated suite passes 119 tests, including public read-only enforcement, mocked providers, and encoded SAS account fixtures.

The application only displays a verified result after a fresh on-chain verification passes. This verified Devnet credential records a demo assessment; its `analysisMode: demo` is authenticated and must never be represented as a real AI evaluation. The optional real OpenAI integration was not exercised by this acceptance run.

- Attestation: [`7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P`](https://explorer.solana.com/address/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P?cluster=devnet)
- [Real Devnet transaction](https://explorer.solana.com/tx/4nbKAbv3t6bNGTkrcEBBMVLC5YRzKppTVrAcKG84R7CnmAgkBeayicpxW6bYaKUueR8Bd3oKQoLx8KA4WHQdBqCN?cluster=devnet)
- [Public proof receipt and verification checks](docs/devnet-proof.json) · [Exact synthetic evidence](docs/demo-evidence.txt)

Presentation materials: [60-second pitch](docs/PITCH_SCRIPT.md), [public demo walkthrough](docs/DEMO_SCRIPT.md), and [technical summary](docs/TECHNICAL_SUMMARY.md).

## Problem and solution

Useful learning happens in projects, experiments, and practice, but that evidence is difficult to turn into a portable signal. A screenshot or database badge is also difficult for a third party to authenticate.

Bridge Proof provides a narrow infrastructure demonstration: analyze submitted evidence, issue a structured assessment under a known issuer, and let another person retrieve and verify that issuer's public attestation. There is no account system or database to carry a credential between browsers.

An AI assessment is a judgment about the supplied evidence. On-chain verification authenticates the record, issuer, schema, and integrity; it does **not** independently prove authorship, identity, competence, or the truth of the original evidence.

## Architecture

| Component | Responsibility |
| --- | --- |
| Next.js App Router + TypeScript | Landing, issuance, credential, and independent verification pages |
| Deterministic demo assessment | Repeatable zero-cost flow, explicitly recorded as `analysisMode: demo` |
| Optional OpenAI Node SDK / Responses API | Real evidence analysis using strict structured output when explicitly enabled |
| Zod schemas | Validate request bodies, AI output, credential fields, and signed previews |
| Server HMAC issuance token | Preserve the analyzed draft and AI mode for 15 minutes; reject client edits |
| `sas-lib` + `@solana/kit` | Derive accounts, encode SAS data, issue and retrieve attestations |
| Solana Devnet | Public source of truth for credential retrieval and verification |

```text
Issuer wallet authority
  └─ SAS credential: BRIDGE_PROOF
      └─ SAS schema: BRIDGE_PROOF_SKILL_V1, version 1
          └─ SAS attestation: public credential + digest + analysis mode
```

No custom Rust/Anchor program, database, authentication, NFTs, tokens, or payment system is included. The implementation uses SAS; a memo or digest-only fallback is not enabled.

Issuance uses a Devnet keypair in an explicitly enabled local workflow. The public deployment contains no issuer keypair and cannot issue credentials. The public issuer, credential account, and schema account are explicitly configured trust anchors. Reading and verifying a credential needs those public values and an RPC endpoint, but no issuer private key, credential-signing secret, or OpenAI key.

Implementation references: [Solana Attestation Service documentation](https://solana.com/docs/tools/attestations), [official SAS source](https://github.com/solana-foundation/solana-attestation-service), and [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Why AI

The optional AI integration translates free-form learning evidence into a consistent skill, level, score, summary, and rationale. The model is selected through `OPENAI_MODEL`, never hardcoded. The Responses API uses a strict JSON schema and its output is validated again with Zod. Incomplete responses, refusals, invalid output, and provider failures stop the real analysis rather than silently substituting an assessment.

For the zero-cost demo, deterministic keyword matching selects a generic skill and returns a fixed Beginner/50 assessment. It is explicitly labeled as a demo fixture, not an AI evaluation. `AI_DEMO_MODE=true` prevents OpenAI calls even if a key is configured. If no key is available, demo mode is the default in every environment, including production.

The score measures the strength of the supplied evidence, not independently verified competence. Skill names come from a fixed generic vocabulary to prevent names or private document titles from becoming on-chain skill labels. Evidence and skill context are treated as untrusted material, including attempted instructions to inflate a score.

## Why Solana

SAS provides issuer authority, credential, schema, and attestation accounts without a custom on-chain program. Anyone with the attestation address and public trust configuration can fetch the same record using an independent RPC provider. Devnet keeps the hackathon flow separate from assets with real financial value.

## Credential and privacy design

The portable credential has this structure:

```json
{
  "subjectHash": "<64 lowercase hexadecimal characters>",
  "skill": "REST API Development",
  "level": "Intermediate",
  "score": 82,
  "evidenceHash": "<64 lowercase hexadecimal characters>",
  "issuer": "Bridge Proof",
  "issuedAt": "<ISO 8601 timestamp>",
  "version": "1.0",
  "solanaReference": "<SAS attestation account address>"
}
```

The schema also stores a domain-separated `credentialHash` and `analysisMode` (`openai` or `demo`). The numeric example above is illustrative, not a recorded live result.

- Raw evidence, skill context, names, emails, government IDs, and private documents are never included in the on-chain payload.
- Raw evidence is sent to the application server. Demo mode never forwards it to OpenAI. If real AI is explicitly enabled, evidence is sent to OpenAI with `store: false`; that is not a claim of zero provider retention. Do not submit sensitive personal information.
- The application has no evidence database. Summary and rationale are returned in the preview but are excluded from the on-chain credential.
- `evidenceHash` is SHA-256 of the exact UTF-8 evidence text, including whitespace and line endings. Hashes are commitments, not encryption; predictable source text can be guessed.
- `subjectHash` is generated from a fresh random value. It is an unlinkable credential handle, not a hash of a name, proof of identity, or wallet ownership claim.
- Generic skill, level, score, issue time, public addresses, hashes, and analysis mode remain publicly visible on-chain.

## How verification works

Every retrieval uses fresh RPC account reads with `confirmed` commitment. The verifier accepts confirmed or finalized account snapshots and rejects processed-only state. Confirmed does not mean irreversible finality.

Verification checks:

1. The RPC genesis hash is Solana Devnet's genesis hash.
2. Attestation, issuer credential, and schema accounts exist, belong to the official SAS program, are non-executable, and have the expected account discriminator bytes.
3. The credential and schema derive to the expected program addresses and match the configured issuer, names, schema version, field names, and layout.
4. The schema is active and the attestation belongs to the trusted credential and schema.
5. The attestation signer is the configured issuer and remains an authorized credential signer.
6. The attestation address derives correctly, it has not expired, and its issue time is valid.
7. The on-chain payload passes the credential schema, references this attestation, has the expected canonical encoding, and matches its SHA-256 credential/provenance digest and deterministic nonce.

Only then does the verifier return `verified: true`. Issuance success, local preview state, a supplied address, or a transaction signature alone never grants verified status. The evidence integrity label means that the evidence hash is authenticated as part of the verified credential; verification does not fetch or inspect the original evidence. A holder can additionally hash the exact original text and compare it with `evidenceHash`.

Attestations expire one year after the draft's issue time. Repeating an issuance request with the same signed draft derives the same attestation address, enabling recovery without creating a second credential. A newly analyzed submission creates a new subject handle and draft.

If submission or confirmation times out, the API preserves the attestation address and transaction signature with HTTP `202` and an unverified/pending state. Retry verification with that address before reanalyzing. Transaction history is displayed when available; account verification does not depend on historical indexing.

## Setup

Use Node.js 22 or newer and npm. Work in this repository's root.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and fill in the values described below. On PowerShell:

```powershell
Copy-Item .env.example .env.local
```

For read-only verification, supply only the public Solana configuration and keep `BRIDGE_PROOF_READ_ONLY=true`. To explicitly enable the full **local** issuance workflow, set `BRIDGE_PROOF_READ_ONLY=false`, generate a unique local signing secret, and place it in `CREDENTIAL_SIGNING_SECRET`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep that value and the issuer wallet out of commits, screenshots, logs, and chat messages. `.env.local` is ignored by Git.

## Environment variables

All application configuration is server-side. Do not prefix secrets with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `BRIDGE_PROOF_READ_ONLY` | Public deployment must use `true`. Absent, empty, or any value other than exactly `false` also disables both POST routes. Only set `false` for the explicitly enabled local issuance workflow. |
| `OPENAI_API_KEY` | Optional. Not used when `AI_DEMO_MODE=true`; leave empty for a zero-cost demo. Required only for real OpenAI analysis. |
| `OPENAI_MODEL` | Required only for real OpenAI mode. Choose an available model supporting Responses API structured outputs; no model default is supplied. |
| `AI_DEMO_MODE` | Set `true` for the zero-cost demo in development or production. This overrides any existing OpenAI key. Without a key, demo mode is always selected. |
| `CREDENTIAL_SIGNING_SECRET` | Local issuance only: unique random secret of at least 32 characters. Do not add it to the public read-only deployment. |
| `SOLANA_RPC_URL` | Optional HTTPS Devnet endpoint. Defaults to `https://api.devnet.solana.com`; use a reliable provider for a public demo. Genesis is checked, not inferred from the URL. |
| `SOLANA_ISSUER_SECRET_KEY` | Local issuance/bootstrap option: entire Solana CLI keypair JSON array containing exactly 64 integers. Never deploy it to the public demo. |
| `SOLANA_ISSUER_KEYPAIR_PATH` | Alternative local issuance/bootstrap option: private keypair JSON file path, such as `.local/devnet-issuer.json` created by the wallet helper. Set only one wallet option; never deploy the file. |
| `SOLANA_ISSUER_PUBLIC_KEY` | Public issuer address printed by bootstrap; required for web issuance and verification. Must match the configured signing wallet. |
| `SAS_CREDENTIAL_ADDRESS` | Public Bridge Proof SAS credential account printed by bootstrap. |
| `SAS_SCHEMA_ADDRESS` | Public Bridge Proof SAS schema account printed by bootstrap. |
| `APP_BASE_URL` | Optional target for `smoke:devnet`; defaults to `http://127.0.0.1:3000`. Set your deployed HTTPS URL to test deployment. |

For the public zero-cost demo, keep `BRIDGE_PROOF_READ_ONLY=true` and `AI_DEMO_MODE=true`, supply only public Solana configuration, and run `npm run dev`. No OpenAI key, model, wallet secret, or signing secret is required. Read-only mode forces demo provenance regardless of other AI settings and disables both POST routes.

The optional local issuance workflow requires `BRIDGE_PROOF_READ_ONLY=false`, a signing secret, and a funded Devnet issuer. With `AI_DEMO_MODE=true`, an existing OpenAI key is preserved but not used. Its deterministic assessment is clearly labeled, uses a fixed Beginner/50 score, and is not an AI assessment. This does not mock Solana: any issued attestation is real and permanently records `analysisMode: demo`.

The same read-only default works with `npm run build` / `npm start` and deployed builds. Optional local real AI requires `BRIDGE_PROOF_READ_ONLY=false`, an available `OPENAI_API_KEY`, `OPENAI_MODEL`, and `AI_DEMO_MODE=false`; those requests may incur provider charges. A provider error in real mode is returned as an error, never disguised as a successful AI assessment.

## Local Devnet bootstrap

The public deployment reuses the existing public credential/schema configuration. Bootstrap and wallet creation are local operator actions, not part of the public walkthrough. Never upload the resulting wallet file.

1. Create a dedicated Devnet issuer wallet locally without needing the Solana CLI:

   ```sh
   npm run wallet:devnet
   ```

   This creates `.local/devnet-issuer.json`, refuses to overwrite an existing file, and prints only its public address. `.local/` is ignored by Git. Set `SOLANA_ISSUER_KEYPAIR_PATH=.local/devnet-issuer.json` in `.env.local`; leave `SOLANA_ISSUER_SECRET_KEY` empty. You may instead supply an existing dedicated Devnet keypair using one of the wallet environment options.

2. Fund its public address with Devnet SOL using the [Solana faucet](https://faucet.solana.com/). Bootstrap checks for at least 0.01 SOL when creating the credential; allow additional balance for rent and repeated demo issuance.
3. Before bootstrap, leave the three public trust variables blank unless they already correspond to this issuer's Bridge Proof deployment.
4. Optionally check RPC connectivity and official SAS deployment without loading a wallet or sending a transaction:

   ```sh
   npm run bootstrap:devnet -- --check
   ```

5. Create or validate the credential authority configuration and schema:

   ```sh
   npm run bootstrap:devnet
   ```

6. Copy the printed `SOLANA_ISSUER_PUBLIC_KEY`, `SAS_CREDENTIAL_ADDRESS`, and `SAS_SCHEMA_ADDRESS` into `.env.local`. Restart the application after changing environment values.

The bootstrap script reuses valid existing accounts, prints public addresses and real transaction Explorer links, and never prints or writes private keys. An unavailable SAS program, wrong network, mismatched configuration, missing funding, or failed transaction is an error. No placeholder proof is substituted.

## Run and test

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). The routes are `/`, `/issue`, `/credential/[id]`, and `/verify`; `[id]` is the SAS attestation account address, not a transaction signature.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Tests cover SHA-256 reference vectors and exact-byte hashing, strict schemas, OpenAI structured output/refusal/configuration behavior, signed preview tampering/expiry, request validation, pending transactions, and independent SAS verification. Adversarial fixtures include wrong issuer, schema, account owner, network, discriminator, unconfirmed state, expiry, malformed data, and altered credential fields or analysis mode. Unit tests never spend Devnet SOL or call OpenAI.

Independent CLI verification uses only the public trust configuration:

```sh
npm run verify:devnet -- <attestation-address>
```

It prints the credential and verification checks as JSON and exits nonzero if verification fails. For independence from the application's RPC provider, configure `SOLANA_RPC_URL` to a different trusted Devnet provider while keeping the same issuer/credential/schema addresses.

## API

| Endpoint | Input / behavior |
| --- | --- |
| `GET /api/config` | Returns public `analysisMode`, `readOnly`, network, and proof type. No secrets are returned. |
| `POST /api/analyze` | Public read-only deployment: `403 READ_ONLY_DEMO`. Enabled local workflow: JSON `{ "evidence": "...", "skillContext": "optional" }` returns analysis, mode, draft, signed `issuanceToken`, and expiry. |
| `POST /api/credentials` | Public read-only deployment: `403 READ_ONLY_DEMO`. Enabled local workflow: JSON `{ "issuanceToken": "..." }` returns credential, transaction signature, and fresh verification (`201` verified / `202` pending). |
| `GET /api/credentials/[id]` | Fetches public chain data and returns the verification result, including the credential only after successful validation. |
| `GET /api/verify/[id]` | Independently fetches and verifies the attestation using the same public checks. |

Evidence must be at least 50 characters after trimming leading/trailing whitespace and at most 20,000 total characters. Optional skill context is limited to 300 characters. Bodies are bounded, unknown fields are rejected, write requests require JSON, cross-origin browser writes are rejected, and responses disable caching. Error responses use `{ "error": { "code": "...", "message": "..." } }` and do not expose raw provider errors.

## Public demo walkthrough

1. Open the existing credential at `/credential/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P` and point out its authenticated demo assessment.
2. Inspect the skill, level, score, issuer, evidence hash, network, and fresh verification checks.
3. Open its real Solana Explorer attestation and transaction links.
4. Copy the attestation account address, open `/verify` in another browser/session, and independently retrieve and verify the same record.
5. Paste the exact contents of [docs/demo-evidence.txt](docs/demo-evidence.txt) into the evidence comparison interface. The matching SHA-256 hash connects that synthetic evidence to the verified public record; changing any character should fail the comparison.

This walkthrough performs no new assessment or issuance and requires no private key or paid API. The complete [demo script](docs/DEMO_SCRIPT.md) follows this read-only path.

## Optional local issuance and acceptance check

1. Locally set `BRIDGE_PROOF_READ_ONLY=false` and `AI_DEMO_MODE=true`, configure the signing secret, bootstrap the funded Devnet issuer, and start the app. No OpenAI credential is needed. Do not enable writes in the public deployment.
2. From the landing page, choose **Issue a credential**.
3. Submit specific non-sensitive evidence, for example:

   > I built a REST API with endpoints to create, list, and update tasks. I added input validation, used a database for persistence, and wrote automated tests covering successful requests, missing fields, and nonexistent task IDs. I documented response codes and explained the tradeoff between pagination and returning all tasks.

4. Inspect the deterministic assessment. Point out the demo label, fixed Beginner/50 score, and absence of a real AI evaluation.
5. Issue the credential. Wait for a real Devnet transaction and independent verification.
6. Open the real Solana Explorer link and save the attestation address.
7. Open `/verify` in another browser/session, enter that address, and check that the retrieved credential passes verification. Run the CLI verifier as a second check.
8. Verify an unrelated address and confirm it cannot produce a verified Bridge Proof credential.

For an automated live acceptance run against the explicitly enabled local application:

```sh
npm run smoke:devnet
```

This checks `/api/config` and requires demo mode **before** requesting an assessment, then issues a real Devnet attestation and retrieves/verifies it through both read APIs. With `AI_DEMO_MODE=true`, no OpenAI request occurs; the run consumes only Devnet SOL for chain fees. It cannot issue through the public read-only deployment. A successful run writes public proof identifiers to `docs/devnet-proof.json` and the synthetic sample evidence to `docs/demo-evidence.txt`. A local assessment fixture alone is not proof of on-chain issuance.

Record the resulting public issuer, credential/schema accounts, attestation address, transaction signature, and successful verification checks for the submission. The zero-cost submission demonstrates deterministic assessment → credential → real Solana Devnet proof → independent verification. Present real OpenAI analysis as an optional integration, not as something demonstrated by this run.

## Deployment

Import this repository into Vercel using the Next.js preset and Node.js 22 or newer. Build with `npm run build`. API handlers run in the Node.js runtime; analysis and issuance declare a 120-second maximum duration. Use a hosting plan that supports the required duration.

Configure only these non-wallet values in Vercel: `BRIDGE_PROOF_READ_ONLY=true`, `AI_DEMO_MODE=true`, optional `SOLANA_RPC_URL`, and the three public bootstrap values `SOLANA_ISSUER_PUBLIC_KEY`, `SAS_CREDENTIAL_ADDRESS`, and `SAS_SCHEMA_ADDRESS`. Reuse the already bootstrapped public configuration.

**Do not deploy `SOLANA_ISSUER_SECRET_KEY`, `SOLANA_ISSUER_KEYPAIR_PATH`, a wallet JSON file, `CREDENTIAL_SIGNING_SECRET`, or `OPENAI_API_KEY`.** No OpenAI model is required. Keep `.env.local` and `.local/` outside deployment artifacts. The public server only reads Solana account state and cannot issue a credential. Use an existing eligible free hosting plan; no purchase is needed to demonstrate the app locally.

Redeploy after changing environment values. Check that both POST routes return `403 READ_ONLY_DEMO`, then reload the existing credential page and verify the proof in a fresh session. Compare the exact synthetic evidence hash. No persistent filesystem or database is required.

## Security and scope limits

The local Devnet issuer wallet is hackathon infrastructure, **not a production custody design**. The public deployment has no wallet or signing secret and sponsors no new transactions. Demo assessment makes no OpenAI calls; the optional local real integration can incur API charges only when enabled. Use a dedicated Devnet-only wallet locally. Never commit API keys, private keys, seed phrases, `.env.local`, or wallet JSON files.

There is no user authentication. The built-in per-instance limiter permits 10 analyses and 5 issuance attempts per minute per apparent client IP. It is a basic safety brake, not distributed abuse protection; header trust and limits must be enforced by the host. Configure hosting-level request limits and spend budgets before making a public demo widely available.

Known scope limits include no learner identity binding, no independent evidence-authorship checks, no production key custody/rotation workflow, and no administrative revocation UI. Current signer authorization and schema pause state are checked on each verification. Devnet availability and RPC history retention are external dependencies.

Dependency audit on October 11, 2026: `npm audit --omit=dev` reported no vulnerabilities. The full audit reported five high-severity entries in the development-only ESLint dependency chain, all originating from the `braces` nested-pattern denial-of-service advisory. The suggested automatic fix would downgrade the Next.js lint configuration across major versions; it was not applied. Recheck advisories before deployment and avoid linting untrusted external glob patterns.

## Hackathon disclosure

Bridge, the underlying AI-first education startup, existed before September 14, including its broader product vision and prior API experimentation.

Bridge Proof itself, its repository, Solana integration, verifiable credential architecture and hackathon MVP are being developed during this hackathon.
