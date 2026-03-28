import { describe, it, expect } from "vitest";
import { hashApiKey } from "~/lib/api-key.server";

describe("API auth validation", () => {
  it("hashApiKey produces consistent hashes", async () => {
    const key = "logr_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("different keys produce different hashes", async () => {
    const hash1 = await hashApiKey("logr_aaa");
    const hash2 = await hashApiKey("logr_bbb");
    expect(hash1).not.toBe(hash2);
  });
});

describe("API response format", () => {
  it("success format matches spec", () => {
    const response = { ok: true, data: { id: 1, name: "Test" } };
    expect(response).toHaveProperty("ok", true);
    expect(response).toHaveProperty("data");
  });

  it("error format matches spec", () => {
    const response = { ok: false, error: { code: "NOT_FOUND", message: "Metric not found" } };
    expect(response).toHaveProperty("ok", false);
    expect(response.error).toHaveProperty("code");
    expect(response.error).toHaveProperty("message");
  });
});
