import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "react-router";

const COOKIE_NAME = "logr_session";
const JWT_EXPIRY = "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  userId: number;
  email: string;
}

export async function createToken(payload: TokenPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRY)
    .sign(key);
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return { userId: payload.userId as number, email: payload.email as string };
}

export function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function requireAuth(request: Request, jwtSecret: string): Promise<TokenPayload> {
  const token = getSessionToken(request);
  if (!token) throw redirect("/login");
  try {
    return await verifyToken(token, jwtSecret);
  } catch {
    throw redirect("/login");
  }
}
