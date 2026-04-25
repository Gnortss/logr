import { useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/_auth.login";
import { getDb } from "~/lib/db.server";
import { hashPassword, comparePassword, createToken, setSessionCookie, getSessionToken, verifyToken } from "~/lib/auth.server";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export async function loader({ request, context }: Route.LoaderArgs) {
  const token = getSessionToken(request);
  if (token) {
    try {
      await verifyToken(token, context.cloudflare.env.JWT_SECRET);
      throw new Response(null, { status: 302, headers: { Location: "/" } });
    } catch (e) {
      if (e instanceof Response) throw e;
    }
  }
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const db = getDb(context.cloudflare.env.DB);
  const jwtSecret = context.cloudflare.env.JWT_SECRET;

  if (intent === "signup") {
    const existing = await db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return { error: "An account with this email already exists." };
    }
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const result = await db.insert(users).values({ email, passwordHash, createdAt: now }).returning();
    const user = result[0];
    const token = await createToken({ userId: user.id, email: user.email }, jwtSecret);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": setSessionCookie(token),
      },
    });
  }

  if (intent === "login") {
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return { error: "Invalid email or password." };
    }
    const token = await createToken({ userId: user.id, email: user.email }, jwtSecret);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": setSessionCookie(token),
      },
    });
  }

  return { error: "Invalid request." };
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <div className="flex mb-6 rounded-full overflow-hidden bg-surface-container-high">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 py-2.5 text-center font-medium text-sm transition-colors ${
            mode === "login"
              ? "bg-primary text-white rounded-full"
              : "text-text-muted"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 py-2.5 text-center font-medium text-sm transition-colors ${
            mode === "signup"
              ? "bg-primary text-white rounded-full"
              : "text-text-muted"
          }`}
        >
          Sign Up
        </button>
      </div>

      <Form method="post">
        <input type="hidden" name="intent" value={mode} />
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text mb-1">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text mb-1">Password</label>
            <input id="password" name="password" type="password" required minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {actionData && "error" in actionData && (
            <p className="text-danger text-sm">{actionData.error}</p>
          )}
          <button type="submit" disabled={isSubmitting}
            className="w-full py-3.5 bg-primary text-white font-semibold text-base rounded-[14px] hover:bg-primary-hover transition-colors disabled:opacity-50 min-h-[44px]">
            {isSubmitting ? "..." : mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </div>
      </Form>
    </>
  );
}
