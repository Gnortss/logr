import type { Route } from "./+types/dashboard[.png]";
import { getDb } from "~/lib/db.server";
import { requireApiKeyFromRequest, checkRateLimit } from "~/lib/api-key.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardPng } from "~/lib/dashboard-png.server";
import { todayInTz } from "~/lib/tz";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);

  let auth;
  try {
    auth = await requireApiKeyFromRequest(request, db);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }
  checkRateLimit(auth.keyId);

  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);

  const data = await getDashboardData(db, auth.userId, todayDate);
  const png = await renderDashboardPng(data);

  return new Response(png as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
