import { describe, it, expect } from "vitest";
import { parseGoogleClaims } from "~/lib/auth.google.server";

describe("parseGoogleClaims", () => {
  it("returns claims with lowercased email when all fields present", () => {
    const claims = parseGoogleClaims({
      sub: "google-uid-123",
      email: "User@Example.COM",
      email_verified: true,
    });
    expect(claims).toEqual({
      sub: "google-uid-123",
      email: "user@example.com",
      emailVerified: true,
    });
  });

  it("preserves email_verified=false", () => {
    const claims = parseGoogleClaims({
      sub: "abc",
      email: "a@b.com",
      email_verified: false,
    });
    expect(claims.emailVerified).toBe(false);
  });

  it("treats missing email_verified as false", () => {
    const claims = parseGoogleClaims({
      sub: "abc",
      email: "a@b.com",
    });
    expect(claims.emailVerified).toBe(false);
  });

  it("throws when sub is missing", () => {
    expect(() => parseGoogleClaims({ email: "a@b.com" })).toThrow(/sub/);
  });

  it("throws when email is missing", () => {
    expect(() => parseGoogleClaims({ sub: "abc" })).toThrow(/email/);
  });

  it("throws when email is not a string", () => {
    expect(() => parseGoogleClaims({ sub: "abc", email: 123 } as never)).toThrow(/email/);
  });
});
