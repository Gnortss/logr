import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import type { Route } from "./+types/root";
import "./styles/tailwind.css";

export function meta() {
  return [
    { title: "Logr" },
    { name: "description", content: "Mobile-first daily metrics tracker" },
    { name: "theme-color", content: "#9b8ec4" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-bg text-text font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-accent mb-2">{error.status}</h1>
          <p className="text-text-muted">{error.statusText || "Page not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-danger mb-2">Error</h1>
        <p className="text-text-muted">Something went wrong</p>
      </div>
    </div>
  );
}
