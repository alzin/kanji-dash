import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/AppIcon";
import { AccountStatus } from "@/components/AccountStatus";
import { BrandMark } from "@/components/BrandMark";
import { SoundToggle } from "@/components/SoundToggle";
import { streakCount, useSave } from "@/lib/srs";

export type MapTarget = { stop?: number; panel?: "camp" | "journey" };

export function ResourceChips() {
  const save = useSave();
  const streak = streakCount(save);
  return (
    <>
      <span className="game-chip" aria-label={`${streak} day streak`} title="Day streak">
        <AppIcon name="flame" />
        <b>{streak}</b>
      </span>
      <span className="game-chip game-chip-mon" aria-label={`${save.coins} mon coins`} title="Mon collected">
        <AppIcon name="coin" />
        <b>{Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(save.coins)}</b>
      </span>
    </>
  );
}

export function GameHud({ back = {}, title, minimal = false }: { back?: MapTarget | false | undefined; title?: string | undefined; minimal?: boolean }) {
  return (
    <header className="game-hud">
      <div className="game-hud-left">
        {back !== false && (
          <Link to="/" search={back} className="game-hud-button" data-sfx="tap">
            <AppIcon name="map" />
            <span>Map</span>
          </Link>
        )}
        {title && (
          <span className="game-hud-title">
            <BrandMark />
            <span>{title}</span>
          </span>
        )}
      </div>
      <div className="game-hud-right">
        {!minimal && <ResourceChips />}
        <AccountStatus />
        <SoundToggle variant="hud" />
      </div>
    </header>
  );
}

export function GameScreen({ back, title, hud = "full", className, children }: {
  back?: MapTarget | false;
  title?: string;
  hud?: "full" | "minimal" | "none";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`game-screen ${className ?? ""}`}>
      {hud !== "none" && <GameHud back={back} title={title} minimal={hud === "minimal"} />}
      <main className="game-screen-main">{children}</main>
    </div>
  );
}
