import type { Route } from "./+types/api.v1.metrics.$id";
import { getDb } from "~/lib/db.server";
import { requireApiKey, checkRateLimit } from "~/lib/api-key.server";
import { metrics } from "~/db/schema";
import { eq, and } from "drizzle-orm";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const { userId, keyId } = await requireApiKey(request, db);
  checkRateLimit(keyId);

  const metric = await db
    .select()
    .from(metrics)
    .where(and(eq(metrics.id, parseInt(params.id)), eq(metrics.userId, userId)))
    .get();

  if (!metric) {
    return Response.json({ ok: false, error: { code: "NOT_FOUND", message: "Metric not found" } }, { status: 404 });
  }

  return Response.json({
    ok: true,
    data: { id: metric.id, name: metric.name, type: metric.type, unit: metric.unit, goal: metric.goal, goalDirection: metric.goalDirection },
  });
}
