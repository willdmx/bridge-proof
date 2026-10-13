# Bridge Proof — demo script

Target length: approximately two minutes. The public deployment stays read-only with `BRIDGE_PROOF_READ_ONLY=true` and `AI_DEMO_MODE=true`. It contains no wallet, credential-signing secret, or OpenAI key. This walkthrough verifies an existing proof; it performs no new analysis or issuance.

The recorded demo succeeded on October 13, 2026 with 20/20 verification checks and no OpenAI call. Existing verified sample: [`7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P`](https://explorer.solana.com/address/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P?cluster=devnet). Its [transaction is public on Devnet](https://explorer.solana.com/tx/4nbKAbv3t6bNGTkrcEBBMVLC5YRzKppTVrAcKG84R7CnmAgkBeayicpxW6bYaKUueR8Bd3oKQoLx8KA4WHQdBqCN?cluster=devnet).

## 1. Explain the problem

“People learn by building projects, but their evidence is difficult to share as a verifiable credential. Bridge Proof turns learning evidence into a portable skill record that another person can verify on Solana.”

## 2. Open the existing credential

Open `/credential/7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P` on the public site. Show its generic REST API Development skill, Beginner level, score of 50, and demo label.

“This credential was issued through the official Solana Attestation Service on Devnet. Its assessment was a deterministic demonstration fixture, and that provenance is recorded on-chain. The fixed score is not proof of competence.”

“The public site is read-only. It has no issuer private key and makes no OpenAI requests. The optional real AI integration was not used for this credential.”

## 3. Inspect the real chain record

Show the live verification result, attestation address, issuer, and network. Open the real Solana Explorer attestation and transaction links.

“The evidence text stays off-chain. The public credential contains its SHA-256 hash and generic skill fields, alongside an authenticated digest and assessment mode.”

Use the actual fresh verification result. If RPC access fails, show that failure; the saved receipt records a past successful run and is not a substitute for current verification.

## 4. Verify independently

Copy the attestation account address, open **Verify a credential** in a fresh browser session, and submit that address. Show the retrieved fields and checks.

“Verification reads public chain state again. It checks the issuer, official SAS program, schema, signer authorization, expiry, address, and credential digest. A local preview or a submitted transaction alone cannot produce this verified status.”

## 5. Compare evidence integrity

Copy the exact text from [demo-evidence.txt](demo-evidence.txt) into the credential's evidence-hash comparison interface. Show a match, then change one character and compare again to show a mismatch. Do not add a trailing newline when copying the original text.

“This connects the exact synthetic evidence to the hash authenticated by the credential. It does not prove who wrote the evidence or whether its claims are true.”

## 6. Close accurately

“Bridge Proof demonstrates portable credentials from evidence, with explicit assessment provenance and independent on-chain verification. Verification proves the integrity and issuer of the record; it does not prove learner identity, authorship, or competence.”

The successful local issuance receipt is in [devnet-proof.json](devnet-proof.json). The public demonstration uses only retrieval, verification, and evidence-hash comparison. Never replace a failed live result with a fabricated identifier or a claimed success.
