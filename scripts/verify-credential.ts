import { verifyCredential } from "../lib/solana";
import { AppError } from "../lib/errors";

async function main() {
  const id = process.argv[2];
  if (!id) throw new AppError("MISSING_IDENTIFIER", "Usage: npm run verify:devnet -- <attestation-address>", 400);
  // Verification uses only public issuer configuration and a fresh confirmed RPC read.
  const result = await verifyCredential(id);
  console.log(JSON.stringify(result, null, 2));
  if (!result.verified) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof AppError ? `${error.code}: ${error.message}` : "Verification could not complete. Check the public SAS configuration and Devnet RPC.");
  process.exitCode = 1;
});
