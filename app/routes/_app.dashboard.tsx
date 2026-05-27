import { useLoaderData } from "react-router";
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
  return { svg };
}

export default function DashboardPage() {
  const { svg } = useLoaderData<typeof loader>();

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
    </div>
  );
}
