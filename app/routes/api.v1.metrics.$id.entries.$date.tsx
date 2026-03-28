import type { Route } from "./+types/api.v1.metrics.$id.entries.$date";
import { getDb } from "~/lib/db.server";
import { requireApiKey, checkRateLimit } from "~/lib/api-key.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and } from "drizzle-orm";

export async function action({ request, context, params }: Route.ActionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use DELETE" } }, { status: 405 });
  }

  const db = getDb(context.cloudflare.env.DB);
  const { userId, keyId } = await requireApiKey(request, db);
  checkRateLimit(keyId);

  const metricId = parseInt(params.id);
  const metric = await db.select().from(metrics)
    .where(and(eq(metrics.id, metricId), eq(metrics.userId, userId))).get();

  if (!metric) {
    return Response.json({ ok: false, error: { code: "NOT_FOUND", message: "Metric not found" } }, { status: 404 });
  }

  await db.delete(metricEntries)
    .where(and(eq(metricEntries.metricId, metricId), eq(metricEntries.date, params.date)));

  return Response.json({ ok: true, data: null });
}
