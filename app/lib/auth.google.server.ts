import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { eq } from "drizzle-orm";
import { users } from "~/db/schema";
import type { Database } from "~/lib/db.server";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export function parseGoogleClaims(payload: JWTPayload): GoogleClaims {
  const sub = payload.sub;
  const emailRaw = payload.email;
  if (!sub) throw new Error("Google ID token missing sub claim");
  if (typeof emailRaw !== "string") throw new Error("Google ID token missing email claim");
  return {
    sub,
    email: emailRaw.toLowerCase(),
    emailVerified: payload.email_verified === true,
  };
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleClaims> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
  });
  return parseGoogleClaims(payload);
}

export interface ResolvedUser {
  id: number;
  email: string;
}

export async function findOrLinkOrCreateUser(
  db: Database,
  claims: GoogleClaims,
): Promise<ResolvedUser> {
  const byGoogle = await db
    .select()
    .from(users)
    .where(eq(users.googleId, claims.sub))
    .get();
  if (byGoogle) return { id: byGoogle.id, email: byGoogle.email };

  const byEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, claims.email))
    .get();
  if (byEmail) {
    await db
      .update(users)
      .set({ googleId: claims.sub })
      .where(eq(users.id, byEmail.id))
      .run();
    return { id: byEmail.id, email: byEmail.email };
  }

  const now = new Date().toISOString();
  const inserted = await db
    .insert(users)
    .values({
      email: claims.email,
      passwordHash: null,
      googleId: claims.sub,
      createdAt: now,
    })
    .returning();
  return { id: inserted[0].id, email: inserted[0].email };
}
