import { eq, and } from "drizzle-orm";
import { apiKeys } from "~/db/schema";
import type { Database } from "./db.server";

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `logr_${hex}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function maskApiKey(key: string): string {
  const last4 = key.slice(-4);
  return `logr_****...${last4}`;
}

export async function createApiKeyForUser(db: Database, userId: number): Promise<string> {
  await db
    .update(apiKeys)
    .set({ active: 0 })
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.active, 1)));

  const key = generateApiKey();
  const keyHash = await hashApiKey(key);

  await db.insert(apiKeys).values({
    userId,
    keyHash,
    createdAt: new Date().toISOString(),
    active: 1,
  });

  return key;
}

export async function validateApiKey(
  db: Database,
  key: string
): Promise<{ userId: number; keyId: number } | null> {
  const keyHash = await hashApiKey(key);
  const row = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, 1)))
    .get();

  if (!row) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, row.id));

  return { userId: row.userId, keyId: row.id };
}

export async function requireApiKey(
  request: Request,
  db: Database
): Promise<{ userId: number; keyId: number }> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing API key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await validateApiKey(db, match[1]);
  if (!result) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return result;
}

const rateLimitMap = new Map<number, { count: number; resetAt: number }>();

export function checkRateLimit(keyId: number): void {
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60_000 });
    return;
  }

  entry.count++;
  if (entry.count > 100) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: "RATE_LIMITED", message: "Too many requests" } }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
}
