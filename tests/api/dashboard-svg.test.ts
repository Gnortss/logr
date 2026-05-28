import { describe, it, expect } from "vitest";
import { loader } from "../../app/routes/dashboard[.svg]";

describe("/dashboard.svg loader", () => {
  it("throws 401 Response when Authorization header is missing", async () => {
    const request = new Request("https://example.com/dashboard.svg");
    const context = { cloudflare: { env: { DB: {} } } } as any;
    try {
      await loader({ request, context, params: {} } as any);
      throw new Error("loader should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });

  it("throws 401 Response when Authorization header is malformed", async () => {
    const request = new Request("https://example.com/dashboard.svg", {
      headers: { Authorization: "NotBearer somekey" },
    });
    const context = { cloudflare: { env: { DB: {} } } } as any;
    try {
      await loader({ request, context, params: {} } as any);
      throw new Error("loader should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });
});
