import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-accent mb-8">Logr</h1>
        <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
