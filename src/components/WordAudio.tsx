import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceEnabled, setVoiceEnabled, useVoiceEnabled } from "@/lib/voice-preference";
import { pronounce, type Playback } from "@/lib/pronunciation";

export { primeSpeech, stopPronunciation } from "@/lib/pronunciation";

export function speakReading(word: string, reading: string): void {
  if (!reading || document.hidden || !getVoiceEnabled()) return;
  pronounce(word, reading);
}

export function WordAudio({ word, reading, wordKey, paused = false, autoPlay = true, variant = "inline", className = "" }: {
  /** The written word: it picks the recorded clip, so homophones like 橋 and 箸 sound right. */
  word: string;
  reading: string;
  wordKey: unknown;
  paused?: boolean;
  autoPlay?: boolean;
  variant?: "inline" | "hud";
  className?: string;
}) {
  const enabled = useVoiceEnabled();
  const [status, setStatus] = useState<"ready" | "unavailable" | "blocked">("ready");
  const current = useRef<{ playback?: Playback } | null>(null);
  const stop = useCallback(() => {
    current.current?.playback?.stop();
    current.current = null;
  }, []);
  const speak = useCallback(() => {
    if (!enabled || paused || !reading || document.hidden) return;
    stop();
    // Status can arrive synchronously, before pronounce returns, when the device voice is used straight away.
    const entry: { playback?: Playback } = {};
    current.current = entry;
    entry.playback = pronounce(word, reading, (next) => { if (current.current === entry) setStatus(next); });
  }, [enabled, paused, word, reading, stop]);

  useEffect(() => {
    if (autoPlay) speak();
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      stop();
    };
  }, [autoPlay, speak, stop, wordKey]);

  const replayDisabled = !enabled || paused || !reading || status === "unavailable";
  const replayTitle = status === "blocked"
    ? "Tap to play. Japanese speech may need to be enabled on your device."
    : autoPlay ? "Automatically reads each word in Japanese. Use Voice to mute." : "Hear this word in Japanese. Use Voice to mute.";

  if (variant === "hud") {
    const hud = "game-round-button";
    return <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button type="button" onClick={() => setVoiceEnabled(!enabled)}
        aria-label={enabled ? "Mute Japanese voice" : "Unmute Japanese voice"}
        aria-pressed={!enabled} title={enabled ? "Japanese voice on" : "Japanese voice off"} className={hud}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" fill="currentColor" fillOpacity="0.35" />
          <path d="M6 11a6 6 0 0 0 12 0" />
          <path d="M12 17v4" />
          <path className="sound-toggle-slash" d="M4 4l16 16" strokeWidth="2"
            strokeDasharray="24" strokeDashoffset={enabled ? 24 : 0} />
        </svg>
      </button>
      <button type="button" onClick={speak} disabled={replayDisabled}
        aria-label="Replay Japanese pronunciation" title={replayTitle} className={hud}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0-1.6 4.8" />
          <path d="M20 5v6h-6" />
        </svg>
      </button>
    </div>;
  }

  const buttonClass = "min-h-11 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold shadow-e1 transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-card";
  return <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
    <button type="button" onClick={() => setVoiceEnabled(!enabled)}
      aria-label={enabled ? "Mute Japanese voice" : "Unmute Japanese voice"}
      aria-pressed={!enabled} className={buttonClass}>
      {enabled ? "Voice on" : "Voice off"}
    </button>
    <button type="button" onClick={speak} disabled={replayDisabled}
      aria-label="Replay Japanese pronunciation" title={replayTitle} className={buttonClass}>
      {status === "unavailable" ? "Speech unavailable" : status === "blocked" ? "Tap to hear Japanese" : "Hear Japanese"}
    </button>
  </div>;
}
