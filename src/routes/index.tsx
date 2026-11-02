import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorldHub, type HubSearch } from "@/components/hub/WorldHub";
import { BrandMark } from "@/components/BrandMark";
import { levelOfChapter } from "@/data";

const stopOf = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? parseInt(value) : NaN;
  return levelOfChapter(n) ? n : undefined;
};

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): HubSearch => {
    const stop = stopOf(s["stop"]);
    return {
      ...(s["panel"] === "camp" || s["panel"] === "journey" ? { panel: s["panel"] } : {}),
      ...(stop !== undefined ? { stop } : {}),
      ...(s["title"] === true || s["title"] === "true" || s["title"] === 1 || s["title"] === "1" ? { title: true as const } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Kanji Dash · Learn Kanji by Playing" },
      {
        name: "description",
        content:
          "Learn kanji by playing. About five minutes a day of forest runs, falling-word puzzles and writing practice takes you through JLPT N5 to N2, one checkpoint at a time.",
      },
      { property: "og:title", content: "Kanji Dash · Learn Kanji by Playing" },
      {
        property: "og:description",
        content: "Learn JLPT kanji through a five-minute daily game, from N5 to N2. Made by someone who lived in Japan for ten years and still couldn’t read kanji.",
      },
    ],
  }),
  component: Hub,
});

function Hub() {
  const search = Route.useSearch();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // The map is drawn from the saved journey, which only exists in this browser after hydration.
  // Until then (and for crawlers) a quiet splash names the game and keeps the legal links reachable.
  if (!ready)
    return (
      <main className="forest-game hub-splash">
        <div className="forest-loading">
          <BrandMark className="brand-mark-splash" />
          <h1>Kanji Dash · The Spirit Trail</h1>
          <p>Unrolling the map…</p>
          <nav aria-label="Legal" className="hub-splash-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
      </main>
    );
  return <WorldHub search={search} />;
}
