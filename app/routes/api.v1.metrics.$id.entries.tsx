import type { Route } from "./+types/api.v1.metrics.$id.entries";
import { getDb } from "~/lib/db.server";
import { requireApiKey, checkRateLimit } from "~/lib/api-key.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, today } from "~/lib/date";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const { userId, keyId } = await requireApiKey(request, db);
  checkRateLimit(keyId);

  const metricId = parseInt(params.id);
  const metric = await db.select().from(metrics)
    .where(and(eq(metrics.id, metricId), eq(metrics.userId, userId))).get();

  if (!metric) {
    return Response.json({ ok: false, error: { code: "NOT_FOUND", message: "Metric not found" } }, { status: 404 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? today();
  const from = url.searchParams.get("from") ?? addDays(to, -6);

  const entries = await db
    .select({ date: metricEntries.date, value: metricEntries.value })
    .from(metricEntries)
    .where(and(eq(metricEntries.metricId, metricId), gte(metricEntries.date, from), lte(metricEntries.date, to)))
    .all();

  return Response.json({ ok: true, data: entries });
}

export async function action({ request, context, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }, { status: 405 });
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

  const body = await request.json() as { date: string; value: number };
  if (!body.date || body.value === undefined) {
    return Response.json({ ok: false, error: { code: "BAD_REQUEST", message: "date and value are required" } }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existing = await db.select().from(metricEntries)
    .where(and(eq(metricEntries.metricId, metricId), eq(metricEntries.date, body.date))).get();

  if (existing) {
    await db.update(metricEntries).set({ value: body.value, updatedAt: now }).where(eq(metricEntries.id, existing.id));
  } else {
    await db.insert(metricEntries).values({ metricId, date: body.date, value: body.value, createdAt: now, updatedAt: now });
  }

  return Response.json({ ok: true, data: { date: body.date, value: body.value } });
}
