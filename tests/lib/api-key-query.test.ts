import { describe, it, expect } from "vitest";
import { extractApiKeyFromRequest } from "~/lib/api-key.server";

describe("extractApiKeyFromRequest", () => {
  it("returns key from Authorization Bearer header", () => {
    const req = new Request("https://x/dashboard.png", {
      headers: { Authorization: "Bearer logr_abc" },
    });
    expect(extractApiKeyFromRequest(req)).toBe("logr_abc");
  });

  it("returns key from ?key= query string when header absent", () => {
    const req = new Request("https://x/dashboard.png?key=logr_xyz");
    expect(extractApiKeyFromRequest(req)).toBe("logr_xyz");
  });

  it("prefers header when both present", () => {
    const req = new Request("https://x/dashboard.png?key=logr_query", {
      headers: { Authorization: "Bearer logr_header" },
    });
    expect(extractApiKeyFromRequest(req)).toBe("logr_header");
  });

  it("returns null when neither is present", () => {
    const req = new Request("https://x/dashboard.png");
    expect(extractApiKeyFromRequest(req)).toBeNull();
  });

  it("treats empty ?key= as missing", () => {
    const req = new Request("https://x/dashboard.png?key=");
    expect(extractApiKeyFromRequest(req)).toBeNull();
  });
});
