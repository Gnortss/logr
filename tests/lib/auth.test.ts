import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword, createToken, verifyToken } from "~/lib/auth.server";

const TEST_SECRET = "test-secret-key-at-least-32-chars-long!!";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).not.toBe("mypassword");
    expect(await comparePassword("mypassword", hash)).toBe(true);
    expect(await comparePassword("wrongpassword", hash)).toBe(false);
  });
});

describe("JWT tokens", () => {
  it("creates and verifies a token", async () => {
    const token = await createToken({ userId: 1, email: "test@test.com" }, TEST_SECRET);
    expect(typeof token).toBe("string");

    const payload = await verifyToken(token, TEST_SECRET);
    expect(payload.userId).toBe(1);
    expect(payload.email).toBe("test@test.com");
  });

  it("rejects an invalid token", async () => {
    await expect(verifyToken("invalid-token", TEST_SECRET)).rejects.toThrow();
  });
});
