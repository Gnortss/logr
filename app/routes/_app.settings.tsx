import { useLoaderData, useFetcher, Link } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/_app.settings";
import { requireAuth, clearSessionCookie } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { metrics, users, apiKeys } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { MetricForm } from "~/components/metric-form";
import { createApiKeyForUser } from "~/lib/api-key.server";
import { GOAL_DIRECTIONS, type MetricType } from "~/lib/types";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);

  const userMetrics = await db.select().from(metrics).where(eq(metrics.userId, user.userId)).all();

  const activeKey = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.userId), eq(apiKeys.active, 1)))
    .get();

  return {
    metrics: userMetrics,
    apiKey: activeKey
      ? { id: activeKey.id, createdAt: activeKey.createdAt, lastUsedAt: activeKey.lastUsedAt }
      : null,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "archive-metric") {
    const metricId = parseInt(formData.get("metricId") as string);
    await db.update(metrics).set({ archived: 1 })
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));
    return { ok: true };
  }

  if (intent === "unarchive-metric") {
    const metricId = parseInt(formData.get("metricId") as string);
    await db.update(metrics).set({ archived: 0 })
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));
    return { ok: true };
  }

  if (intent === "delete-metric") {
    const metricId = parseInt(formData.get("metricId") as string);
    await db.delete(metrics)
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));
    return { ok: true };
  }

  if (intent === "edit-metric") {
    const metricId = parseInt(formData.get("metricId") as string);
    const name = (formData.get("name") as string)?.trim();
    const goalStr = formData.get("goal") as string;
    const goal = goalStr ? parseFloat(goalStr) : null;
    const goalDirection = (formData.get("goalDirection") as string) || null;
    if (!name) return { error: "Name is required." };
    if (goalDirection && !GOAL_DIRECTIONS.includes(goalDirection as any)) {
      return { error: "Invalid goal direction." };
    }
    await db.update(metrics).set({ name, goal, goalDirection: goal != null ? goalDirection : null })
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));
    return { ok: true };
  }

  if (intent === "generate-api-key" || intent === "rotate-api-key") {
    const fullKey = await createApiKeyForUser(db, user.userId);
    return { newApiKey: fullKey };
  }

  if (intent === "logout") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login", "Set-Cookie": clearSessionCookie() },
    });
  }

  if (intent === "delete-account") {
    await db.delete(users).where(eq(users.id, user.userId));
    return new Response(null, {
      status: 302,
      headers: { Location: "/login", "Set-Cookie": clearSessionCookie() },
    });
  }

  return { error: "Unknown intent." };
}

export default function SettingsView() {
  const { metrics: allMetrics, apiKey } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [editingMetric, setEditingMetric] = useState<typeof allMetrics[0] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const activeMetrics = allMetrics.filter((m) => !m.archived);
  const archivedMetrics = allMetrics.filter((m) => m.archived);

  return (
    <div className="p-4 space-y-8">
      <div>
        <Link to="/" className="text-primary text-sm font-semibold font-heading">← Back</Link>
      </div>

      <section>
        <h2 className="text-lg font-semibold font-heading text-text mb-3">Metrics</h2>
        <div className="space-y-3">
          {activeMetrics.map((m) => (
            <div key={m.id} className="flex items-start justify-between bg-bg-card rounded-xl px-4 py-3">
              <div className="flex flex-col gap-1">
                <span className="text-text font-medium">{m.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-secondary font-medium w-fit">{m.type}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingMetric(m)}
                  className="text-xs text-primary font-medium min-h-[36px] px-2">Edit</button>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="archive-metric" />
                  <input type="hidden" name="metricId" value={m.id} />
                  <button type="submit" className="text-xs text-text-muted font-medium min-h-[36px] px-2">Archive</button>
                </fetcher.Form>
                {confirmDelete === m.id ? (
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete-metric" />
                    <input type="hidden" name="metricId" value={m.id} />
                    <button type="submit" className="text-xs text-danger font-medium min-h-[36px] px-2">Confirm</button>
                  </fetcher.Form>
                ) : (
                  <button onClick={() => setConfirmDelete(m.id)}
                    className="text-xs text-danger font-medium min-h-[36px] px-2">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {archivedMetrics.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium font-heading text-text-muted mb-2">Archived</h3>
            <div className="space-y-3">
              {archivedMetrics.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-bg-card rounded-xl px-4 py-3 opacity-60">
                  <span className="text-text">{m.name}</span>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="unarchive-metric" />
                    <input type="hidden" name="metricId" value={m.id} />
                    <button type="submit" className="text-xs text-primary font-medium min-h-[36px] px-2">Restore</button>
                  </fetcher.Form>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold font-heading text-text mb-3">API Key</h2>
        <ApiKeySection apiKey={apiKey} />
      </section>

      <section>
        <h2 className="text-lg font-semibold font-heading text-text mb-3">Account</h2>
        <div className="space-y-3">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="logout" />
            <button type="submit"
              className="w-full py-3 bg-surface-container-high text-text font-medium rounded-xl min-h-[44px]">
              Log Out
            </button>
          </fetcher.Form>
          {confirmDeleteAccount ? (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-account" />
              <button type="submit"
                className="w-full py-3 bg-danger text-white font-medium rounded-xl min-h-[44px]">
                Confirm Delete Account
              </button>
            </fetcher.Form>
          ) : (
            <button onClick={() => setConfirmDeleteAccount(true)}
              className="w-full py-3 text-danger font-medium rounded-xl min-h-[44px]">
              Delete Account
            </button>
          )}
        </div>
      </section>

      {editingMetric && (
        <MetricForm
          open={!!editingMetric}
          onClose={() => setEditingMetric(null)}
          metric={{
            id: editingMetric.id,
            name: editingMetric.name,
            type: editingMetric.type as MetricType,
            unit: editingMetric.unit,
            goal: editingMetric.goal,
            goalDirection: editingMetric.goalDirection,
          }}
        />
      )}
    </div>
  );
}

function ApiKeySection({ apiKey }: { apiKey: { id: number; createdAt: string; lastUsedAt: string | null } | null }) {
  const fetcher = useFetcher<{ newApiKey?: string }>();
  const [copied, setCopied] = useState(false);
  const newKey = fetcher.data?.newApiKey;

  async function copyKey() {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-3">
      {newKey ? (
        <div className="bg-primary-fixed rounded-xl p-4">
          <p className="text-xs text-danger font-medium mb-2">
            Copy this key now — it won't be shown again.
          </p>
          <code className="text-sm text-text break-all block mb-3">{newKey}</code>
          <button onClick={copyKey}
            className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium min-h-[36px]">
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      ) : apiKey ? (
        <div className="bg-bg-card rounded-xl p-4">
          <div className="text-sm text-text-muted mb-1">Active Key</div>
          <div className="text-sm text-text font-mono">logr_****...****</div>
          {apiKey.lastUsedAt && (
            <div className="text-xs text-text-muted mt-1">
              Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-muted">No API key generated yet.</p>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value={apiKey ? "rotate-api-key" : "generate-api-key"} />
        <button type="submit"
          className="w-full py-3 bg-surface-container-high text-text font-medium rounded-xl min-h-[44px]">
          {apiKey ? "Rotate Key" : "Generate API Key"}
        </button>
      </fetcher.Form>
    </div>
  );
}
