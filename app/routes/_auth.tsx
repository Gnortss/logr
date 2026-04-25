import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <h1 className="text-3xl font-bold font-heading text-text tracking-tight">Logr</h1>
        </div>
        <div className="bg-bg-card rounded-xl p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
