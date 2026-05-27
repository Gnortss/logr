import type { Route } from "./+types/dashboard[.png]";
import { getDb } from "~/lib/db.server";
import { requireApiKeyFromRequest, checkRateLimit } from "~/lib/api-key.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardPng, renderErrorPng, setRequestContext } from "~/lib/dashboard-png.server";
import { todayInTz } from "~/lib/tz";

async function errorPngResponse(status: number, message: string): Promise<Response> {
  const png = await renderErrorPng(message);
  return new Response(png as unknown as BodyInit, {
    status,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  setRequestContext(request);
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);

  // Auth
  let auth;
  try {
    auth = await requireApiKeyFromRequest(request, db);
  } catch (res) {
    if (res instanceof Response) {
      return errorPngResponse(res.status, "Unauthorized");
    }
    throw res;
  }

  // Rate limit
  try {
    checkRateLimit(auth.keyId);
  } catch (res) {
    if (res instanceof Response) {
      return errorPngResponse(res.status, "Rate limited");
    }
    throw res;
  }

  // Render
  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);

  try {
    const data = await getDashboardData(db, auth.userId, todayDate);
    const png = await renderDashboardPng(data);
    return new Response(png as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorPngResponse(500, "Render error");
  }
}
