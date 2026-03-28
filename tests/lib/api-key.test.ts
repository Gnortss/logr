import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, maskApiKey } from "~/lib/api-key.server";

describe("API key generation", () => {
  it("generates a key with logr_ prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("logr_")).toBe(true);
    expect(key.length).toBe(69);
  });

  it("generates unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
  });
});

describe("API key hashing", () => {
  it("produces consistent SHA-256 hash", async () => {
    const key = "logr_abc123";
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(key);
  });
});

describe("API key masking", () => {
  it("masks the key showing prefix and last 4 chars", () => {
    const key = "logr_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";
    const masked = maskApiKey(key);
    expect(masked).toBe("logr_****...e5f6");
  });
});
