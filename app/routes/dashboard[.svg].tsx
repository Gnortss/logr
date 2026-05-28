import type { Route } from "./+types/dashboard[.svg]";
import { requireApiKey } from "~/lib/api-key.server";
import { getDb } from "~/lib/db.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import { todayInTz } from "~/lib/tz";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const { userId } = await requireApiKey(request, db);
  const url = new URL(request.url);
  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);
  const data = await getDashboardData(db, userId, todayDate);
  const svg = renderDashboardSvg(data, { mode: "bw" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
