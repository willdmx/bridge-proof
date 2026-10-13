/** Public deployments are read-only unless an operator explicitly enables local issuance. */
export function isReadOnlyDemo(): boolean {
  return process.env.BRIDGE_PROOF_READ_ONLY !== "false";
}

export const DEMO_ATTESTATION_ID = "7Safc4u3STxFdjfo84NPwg5ZMcG8DVHef9tE6VwEEW1P";
