import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { openAccountPrompt, useAccount } from "@/lib/account";
import { BrandMark } from "@/components/BrandMark";
import { MusicToggle } from "@/components/MusicToggle";
import { LEVELS, levelWeeks } from "@/data";

export function TitleCard({ onStart }: { onStart: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const account = useAccount();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    start.current?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="hub-title"
      aria-labelledby="hub-title-heading"
      onCancel={(event) => {
        event.preventDefault();
        onStart();
      }}
    >
      <div className="hub-title-inner">
        <div className="forest-wordmark hub-title-brand">
          <BrandMark />
          <span>KANJI DASH<small>A JAPANESE LEARNING ADVENTURE</small></span>
        </div>
        <span className="forest-eyebrow hub-title-eyebrow">THE SPIRIT TRAIL</span>
        <h1 id="hub-title-heading">
          Learn kanji
          <br />
          <em>by playing.</em>
        </h1>
        <p>
          Kanji Dash turns kanji study into a short daily game. Run the forest trail, stack falling words, and earn a seal for each region you clear.
        </p>
        <dl className="hub-title-levels">
          {LEVELS.map((level) => (
            <div key={level}>
              <dt>{level}</dt>
              <dd>~{levelWeeks(level)} weeks</dd>
            </div>
          ))}
        </dl>
        <p className="hub-title-levels-note">Rough time per level at one region a day.</p>
        <figure className="hub-title-founder">
          <blockquote>“I lived in Japan for 10 years and still couldn’t read kanji. So I built a game I’d play every day.”</blockquote>
          <figcaption>Ghaith, maker of Kanji Dash</figcaption>
        </figure>
        <button ref={start} type="button" className="forest-primary hub-title-start" onClick={onStart} data-sfx="tap">
          Start playing <span aria-hidden="true">→</span>
        </button>
        <span className="forest-title-note">
          CHAPTER 01 <i /> KODAMA WOODS <i /> ABOUT 5 MINUTES
        </span>
        <footer className="hub-title-footer">
          {!account.user && (
            <button type="button" onClick={openAccountPrompt} disabled={account.phase === "checking"}>
              Already travelling? Sign in
            </button>
          )}
          <MusicToggle />
          <span>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </span>
        </footer>
      </div>
      <div className="hub-title-caption" aria-hidden="true">
        <span>木霊の森</span>
        <small>Kodama: the spirits said to live in old trees.</small>
      </div>
    </dialog>
  );
}
