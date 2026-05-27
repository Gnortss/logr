import { useLoaderData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/_app.dashboard";
import { requireAuth } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import { todayInTz } from "~/lib/tz";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);
  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);
  const data = await getDashboardData(db, user.userId, todayDate);
  const svg = renderDashboardSvg(data, { mode: "color" });
  return { svg, tz };
}

export default function DashboardPage() {
  const { svg, tz } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);

  function copyDeviceUrl() {
    const origin = window.location.origin;
    const tzParam = tz ? `&tz=${encodeURIComponent(tz)}` : "";
    const url = `${origin}/dashboard.png?key=YOUR_API_KEY${tzParam}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-heading font-semibold mb-3">Dashboard</h1>
      <div className="bg-bg-card border border-outline-variant rounded-xl p-2 inline-block">
        {/* svg is built server-side via renderDashboardSvg, which escapes all user data via esc(); safe to inject. */}
        <div
          style={{ width: 400, height: 300 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="mt-4">
        <button
          onClick={copyDeviceUrl}
          className="px-3 py-2 bg-surface-container-high text-text-muted rounded-lg text-sm hover:bg-surface-container-highest"
        >
          {copied ? "Copied ✓" : "Copy device URL"}
        </button>
        <p className="mt-2 text-xs text-text-muted">
          Replace <code>YOUR_API_KEY</code> with a key from{" "}
          <a className="underline" href="/settings">settings</a>.
        </p>
      </div>
    </div>
  );
}
