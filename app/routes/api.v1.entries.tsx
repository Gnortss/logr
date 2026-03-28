import type { Route } from "./+types/api.v1.entries";
import { getDb } from "~/lib/db.server";
import { requireApiKey, checkRateLimit } from "~/lib/api-key.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, today } from "~/lib/date";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const { userId, keyId } = await requireApiKey(request, db);
  checkRateLimit(keyId);

  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? today();
  const from = url.searchParams.get("from") ?? addDays(to, -6);

  const userMetrics = await db
    .select({ id: metrics.id })
    .from(metrics)
    .where(eq(metrics.userId, userId))
    .all();

  const metricIds = userMetrics.map((m) => m.id);
  if (metricIds.length === 0) {
    return Response.json({ ok: true, data: [] });
  }

  const allEntries = await db
    .select({ metricId: metricEntries.metricId, date: metricEntries.date, value: metricEntries.value })
    .from(metricEntries)
    .where(and(gte(metricEntries.date, from), lte(metricEntries.date, to)))
    .all();

  const metricIdSet = new Set(metricIds);
  const filtered = allEntries.filter((e) => metricIdSet.has(e.metricId));

  return Response.json({ ok: true, data: filtered });
}
