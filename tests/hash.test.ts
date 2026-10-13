import { describe, expect, it } from "vitest";
import { canonicalCredential, hashCredential, hashEvidence } from "../lib/hash";
import { validCredential } from "./fixtures";

describe("evidence SHA-256", () => {
  it("matches published SHA-256 test vectors", () => {
    expect(hashEvidence("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hashEvidence("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes exact bytes without trimming or normalizing line endings", () => {
    const inputs = ["evidence", " evidence", "evidence ", "evidence\n", "evidence\r\n"];
    expect(new Set(inputs.map(hashEvidence)).size).toBe(inputs.length);
  });

  it("does not silently normalize visually similar Unicode", () => {
    expect(hashEvidence("caf\u00e9")).not.toBe(hashEvidence("cafe\u0301"));
  });
});

describe("credential digest", () => {
  it("uses canonical ordering independent of object insertion order", () => {
    const reordered = Object.fromEntries(Object.entries(validCredential).reverse());
    expect(canonicalCredential(reordered as typeof validCredential)).toBe(canonicalCredential(validCredential));
    expect(hashCredential(reordered as typeof validCredential)).toBe(hashCredential(validCredential));
  });

  it.each(["skill", "score", "evidenceHash", "subjectHash", "solanaReference"] as const)("detects a changed %s", (field) => {
    const alternatives = {
      skill: "Backend Development",
      score: 83,
      evidenceHash: "c".repeat(64),
      subjectHash: "d".repeat(64),
      solanaReference: "22222222222222222222222222222222",
    };
    const changed = { ...validCredential, [field]: alternatives[field] };
    expect(hashCredential(changed as typeof validCredential)).not.toBe(hashCredential(validCredential));
  });

  it("rejects unrecognized credential properties before hashing", () => {
    expect(() => canonicalCredential({ ...validCredential, email: "private@example.test" } as typeof validCredential)).toThrow();
  });
});
