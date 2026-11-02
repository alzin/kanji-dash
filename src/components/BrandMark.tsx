// The Kanji Dash logo beside the wordmark, repainted in the forest gold on a
// transparent ground (scripts/build-icons.mjs). The full-colour tile stays the app icon.
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-mark ${className}`.trim()}
      src={`${import.meta.env.BASE_URL}icons/brand-mark.png`}
      alt=""
      width={48}
      height={48}
      draggable={false}
    />
  );
}
