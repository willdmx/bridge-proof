import { generateKeyPairSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createKeyPairSignerFromBytes } from "@solana/kit";

async function main() {
  const directory = resolve(process.cwd(), ".local");
  const target = resolve(directory, "devnet-issuer.json");
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  if (!jwk.d || !jwk.x) throw new Error("Key generation failed");
  const secret = Buffer.concat([Buffer.from(jwk.d, "base64url"), Buffer.from(jwk.x, "base64url")]);
  const signer = await createKeyPairSignerFromBytes(secret);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Exclusive creation prevents accidental replacement of a funded or configured wallet.
  await writeFile(target, JSON.stringify(Array.from(secret)), { flag: "wx", mode: 0o600 });
  secret.fill(0);
  console.log(`Created local Devnet issuer keypair: ${target}`);
  console.log(`Public address: ${signer.address}`);
  console.log("Add SOLANA_ISSUER_KEYPAIR_PATH=.local/devnet-issuer.json to .env.local.");
  console.log(`Fund the PUBLIC address with Devnet SOL at https://faucet.solana.com, then run npm run bootstrap:devnet.`);
  console.log("The .local directory is gitignored. Do not share or commit the keypair file.");
}

main().catch((error: unknown) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
    console.error("A local issuer keypair already exists. It was not overwritten. Use SOLANA_ISSUER_KEYPAIR_PATH=.local/devnet-issuer.json to reuse it.");
  } else {
    console.error("Could not create the local issuer keypair. Check filesystem permissions and Node.js support for Ed25519.");
  }
  process.exitCode = 1;
});
