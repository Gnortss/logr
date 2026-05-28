import type { Route } from "./+types/auth.google.callback";
import { getDb } from "~/lib/db.server";
import { createToken, setSessionCookie } from "~/lib/auth.server";
import {
  verifyGoogleIdToken,
  findOrLinkOrCreateUser,
} from "~/lib/auth.google.server";

const CSRF_COOKIE = "g_csrf_token";

export async function loader() {
  return new Response(null, { status: 405 });
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const credential = form.get("credential");
  const csrfBody = form.get(CSRF_COOKIE);

  if (typeof credential !== "string" || typeof csrfBody !== "string") {
    return new Response("Missing fields", { status: 400 });
  }

  const cookieHeader = request.headers.get("Cookie") ?? "";
  const csrfCookie = cookieHeader.match(
    new RegExp(`${CSRF_COOKIE}=([^;]+)`),
  )?.[1];
  if (!csrfCookie || csrfCookie !== csrfBody) {
    return new Response("CSRF check failed", { status: 403 });
  }

  const env = context.cloudflare.env;
  let claims;
  try {
    claims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  } catch {
    return new Response("Invalid Google credential", { status: 401 });
  }
  if (!claims.emailVerified) {
    return new Response("Google email not verified", { status: 401 });
  }

  const db = getDb(env.DB);
  const user = await findOrLinkOrCreateUser(db, claims);

  const token = await createToken(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": setSessionCookie(token),
    },
  });
}
