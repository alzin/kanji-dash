import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

// Server: a redirect. Browser and offline shell: a move once the page has hydrated.
export const Route = createFileRoute("/map")({
  beforeLoad: () => {
    if (typeof window === "undefined") throw redirect({ to: "/", search: { panel: "journey" }, replace: true });
  },
  component: () => <Navigate to="/" search={{ panel: "journey" }} replace />,
});
