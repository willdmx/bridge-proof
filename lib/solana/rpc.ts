import {
  appendTransactionMessageInstructions, createTransactionMessage, getBase64EncodedWireTransaction,
  getSignatureFromTransaction, pipe, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners,
  isSolanaError,
  type Address, type Instruction, type TransactionSigner,
} from "@solana/kit";
import { SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS } from "sas-lib";
import { AppError } from "../errors";
import type { SolanaRpc } from "./config";
import { DEVNET_GENESIS_HASH } from "./schema";
import type { RawSolanaAccount } from "./verification";

const timeout = () => ({ abortSignal: AbortSignal.timeout(10_000) });

export class PendingSolanaTransactionError extends AppError {
  constructor(public reference: string, public transactionSignature: string) {
    super("SOLANA_CONFIRMATION_PENDING", "The transaction was submitted, but confirmation is still pending. Verify the attestation address before retrying.", 202);
    this.name = "PendingSolanaTransactionError";
  }
}

export async function readGenesisHash(rpc: SolanaRpc): Promise<string> {
  try { return await rpc.getGenesisHash().send(timeout()); }
  catch { throw new AppError("SOLANA_RPC_UNAVAILABLE", "Unable to reach Solana Devnet. Check SOLANA_RPC_URL or try again shortly.", 503); }
}

export async function assertDevnet(rpc: SolanaRpc): Promise<void> {
  if (await readGenesisHash(rpc) !== DEVNET_GENESIS_HASH) throw new AppError("WRONG_SOLANA_NETWORK", "SOLANA_RPC_URL must point to Solana Devnet. No transaction was sent.", 503);
}

export async function fetchRawAccount(rpc: SolanaRpc, accountAddress: Address): Promise<RawSolanaAccount | null> {
  try {
    const response = await rpc.getAccountInfo(accountAddress, { encoding: "base64", commitment: "confirmed" }).send(timeout());
    if (!response.value) return null;
    return { owner: response.value.owner, executable: response.value.executable, data: Uint8Array.from(Buffer.from(response.value.data[0], "base64")) };
  } catch { throw new AppError("SOLANA_RPC_UNAVAILABLE", "Unable to fetch confirmed Solana account data. Try verification again shortly.", 503); }
}

export async function assertSasProgram(rpc: SolanaRpc): Promise<void> {
  const program = await fetchRawAccount(rpc, SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS);
  if (!program?.executable) throw new AppError("SAS_PROGRAM_UNAVAILABLE", "The official Solana Attestation Service program is unavailable on this Devnet RPC.", 503);
}

export async function latestSuccessfulSignature(rpc: SolanaRpc, accountAddress: Address): Promise<string | undefined> {
  try {
    const transactions = await rpc.getSignaturesForAddress(accountAddress, { commitment: "confirmed", limit: 10 }).send(timeout());
    return transactions.find((tx) => tx.err === null && (tx.confirmationStatus === "confirmed" || tx.confirmationStatus === "finalized"))?.signature;
  } catch { return undefined; } // Historical indexing is optional; confirmed account validation is authoritative.
}

/** HTTP polling works on Vercel without a websocket connection. */
export async function sendConfirmedInstructions(
  rpc: SolanaRpc, signer: TransactionSigner, instructions: Instruction[], reference: string,
): Promise<string> {
  await assertDevnet(rpc);
  let transactionSignature: string | undefined;
  let acceptedByRpc = false;
  try {
    const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send(timeout());
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
    );
    const signed = await signTransactionMessageWithSigners(message);
    const signature = getSignatureFromTransaction(signed);
    const encoded = getBase64EncodedWireTransaction(signed);
    transactionSignature = signature;
    await rpc.sendTransaction(encoded, {
      encoding: "base64", preflightCommitment: "confirmed", skipPreflight: false, maxRetries: 3n,
    }).send(timeout());
    acceptedByRpc = true;
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const { value: statuses } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send(timeout());
      const status = statuses[0];
      if (status?.err) throw new AppError("SOLANA_TRANSACTION_FAILED", "Solana rejected the transaction. Check the issuer balance and SAS configuration before retrying.", 502);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new PendingSolanaTransactionError(reference, signature);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (!acceptedByRpc && isSolanaError(error) && error.context.__code < 0) {
      throw new AppError("SOLANA_TRANSACTION_FAILED", "The Solana RPC rejected the transaction. Check the issuer Devnet balance and SAS configuration, then retry.", 502);
    }
    // A transport timeout after sending is ambiguous: expose recovery identifiers, never success.
    if (transactionSignature) throw new PendingSolanaTransactionError(reference, transactionSignature);
    throw new AppError("SOLANA_TRANSACTION_FAILED", "Unable to prepare the Solana transaction. Check the Devnet RPC and issuer configuration.", 502);
  }
}
