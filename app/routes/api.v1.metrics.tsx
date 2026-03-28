import type { Route } from "./+types/api.v1.metrics";
import { getDb } from "~/lib/db.server";
import { requireApiKey, checkRateLimit } from "~/lib/api-key.server";
import { metrics } from "~/db/schema";
import { eq, and } from "drizzle-orm";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const { userId, keyId } = await requireApiKey(request, db);
  checkRateLimit(keyId);

  const result = await db
    .select({ id: metrics.id, name: metrics.name, type: metrics.type, unit: metrics.unit, goal: metrics.goal })
    .from(metrics)
    .where(and(eq(metrics.userId, userId), eq(metrics.archived, 0)))
    .all();

  return Response.json({ ok: true, data: result });
}
