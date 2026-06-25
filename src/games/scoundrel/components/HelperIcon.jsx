// Fixed-size monochrome icons for the card helper lines and the bare-hands
// button. They replace the emoji/symbol characters (⚔ ✊ ♥ ✸ ⚒) that used to
// prefix those lines.
//
// Why: those glyphs render as narrow monochrome text on some machines but as
// wide color emoji on others (older Chrome / older Windows emoji fonts pick
// emoji presentation for these ambiguous symbols). The extra width shoved the
// centered helper text sideways, so the line looked off-center on some devices
// and fine on others. An inline SVG has a fixed size and renders identically
// everywhere, so the line stays centered on every machine. See [[no-page-scroll]]
// sibling note: this is layout robustness, not styling.
//
//   weapon   – upright sword  (monster: your weapon will swing)
//   bare     – clenched fist  (monster: bare-handed)
//   heal     – heart          (sweet potion)
//   sour     – droplet        (sour potion deals damage)
//   strength – up arrow       (potion of strength buffs strikes)

const GLYPHS = {
  weapon: (
    <>
      <path
        d="M12 2.5V13M8.6 13h6.8M12 13v4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="19.4" r="1.5" />
    </>
  ),
  bare: (
    <>
      <path d="M6.6 12a1.3 1.3 0 0 1 2.6 0 1.3 1.3 0 0 1 2.6 0 1.3 1.3 0 0 1 2.6 0 1.3 1.3 0 0 1 2.6 0v4a3 3 0 0 1-3 3H9.6a3 3 0 0 1-3-3z" />
      <path d="M6.6 13.6a1.7 1.7 0 0 0 0 3.2z" />
    </>
  ),
  heal: (
    <path d="M12 20.3C5.7 15 3.7 11.6 3.7 8.8c0-2.3 1.8-4 4.1-4 1.7 0 3.3 1.1 4.2 2.6.9-1.5 2.5-2.6 4.2-2.6 2.3 0 4.1 1.7 4.1 4 0 2.8-2 6.2-8.3 11.5z" />
  ),
  sour: (
    <path d="M12 3.2s-6.3 7.7-6.3 11.5a6.3 6.3 0 0 0 12.6 0C18.3 10.9 12 3.2 12 3.2z" />
  ),
  strength: (
    <path
      d="M12 19V6M7 11l5-5 5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
}

export function HelperIcon({ kind, className = '' }) {
  const glyph = GLYPHS[kind]
  if (!glyph) return null
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-[1.05em] h-[1.05em] shrink-0 ${className}`}
      fill="currentColor"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}
