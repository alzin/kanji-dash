import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

// Old links and installed shortcuts still land here. Server: a redirect; browser and offline
// shell (which must hydrate before it may change route): a move once rendered.
export const Route = createFileRoute("/camp")({
  beforeLoad: () => {
    if (typeof window === "undefined") throw redirect({ to: "/", search: { panel: "camp" }, replace: true });
  },
  component: () => <Navigate to="/" search={{ panel: "camp" }} replace />,
});
