/**
 * PaperString Elements Library — built-in stickers (FR-12.2).
 * Crisp SVG artwork, embedded as data URLs so layers render identically in the
 * editor, thumbnails and published pages.
 */

export interface StickerDef {
  id: string;
  label: string;
  category: "Hearts" | "Stars" | "Nature" | "Symbols" | "Decor";
  svg: string;
}

const svgUrl = (inner: string, vb = "0 0 100 100") => {
  // Inject explicit width/height (parsed from the viewBox) so <Image> gets
  // reliable intrinsic dimensions across browsers.
  const m = vb.match(/0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
  const w = m ? m[1] : "100";
  const h = m ? m[2] : "100";
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`
  )}`;
};

export const STICKERS: StickerDef[] = [
  // ── Hearts ────────────────────────────────────────────────
  {
    id: "heart-classic",
    label: "Heart",
    category: "Hearts",
    svg: svgUrl(
      `<path d="M50 88C22 68 6 52 6 33 6 18 18 8 31 8c8 0 15 4 19 11 4-7 11-11 19-11 13 0 25 10 25 25 0 19-16 35-44 55z" fill="#e8446a"/>`
    ),
  },
  {
    id: "heart-outline",
    label: "Heart outline",
    category: "Hearts",
    svg: svgUrl(
      `<path d="M50 84C24 66 10 51 10 33.5 10 20 20.5 11 32 11c7.4 0 14 3.7 18 9.9C54 14.7 60.6 11 68 11c11.5 0 22 9 22 22.5C90 51 76 66 50 84z" fill="none" stroke="#e8446a" stroke-width="7" stroke-linejoin="round"/>`
    ),
  },
  {
    id: "heart-double",
    label: "Twin hearts",
    category: "Hearts",
    svg: svgUrl(
      `<path d="M35 78C16 63 6 51 6 37.5 6 26 14.5 19 23.5 19c5.5 0 10 2.6 11.5 6.5C36.5 21.6 41 19 46.5 19 55.5 19 64 26 64 37.5 64 51 54 63 35 78z" fill="#ff7a9c"/><path d="M74 96C58 83 50 73 50 62 50 52.5 57 47 64 47c4.5 0 8 2.1 9.5 5.2C75 49.1 78.5 47 83 47c7 0 14 5.5 14 15 0 11-8 21-23 34z" fill="#e8446a"/>`
    ),
  },
  {
    id: "heart-arrow",
    label: "Heart & arrow",
    category: "Hearts",
    svg: svgUrl(
      `<path d="M46 78C24 61 12 49 12 35.5 12 24 21 16 30.5 16c6.3 0 11.9 3 15.5 8 3.6-5 9.2-8 15.5-8C71 16 80 24 80 35.5 80 49 68 61 46 78z" fill="#e8446a"/><path d="M8 20 68 74" stroke="#646464" stroke-width="5" stroke-linecap="round"/><path d="M60 68l12-2 4-11 6 15-20 5z" fill="#646464" transform="rotate(43 66 66)"/>`
    ),
  },
  {
    id: "heart-sparkle",
    label: "Sparkle heart",
    category: "Hearts",
    svg: svgUrl(
      `<path d="M50 88C22 68 8 52 8 33 8 19 19 9 31.5 9 39 9 46 13 50 19c4-6 11-10 18.5-10C81 9 92 19 92 33c0 19-14 35-42 55z" fill="#f5b8cf"/><path d="M50 30l4.5 11.5L66 46l-11.5 4.5L50 62l-4.5-11.5L34 46l11.5-4.5z" fill="#e8446a"/><circle cx="70" cy="28" r="4" fill="#e8446a"/><circle cx="30" cy="62" r="3" fill="#e8446a"/>`
    ),
  },

  // ── Stars & sparkles ─────────────────────────────────────
  {
    id: "star",
    label: "Star",
    category: "Stars",
    svg: svgUrl(
      `<path d="M50 6l12.4 27.6L92 37.6 69.4 58.5 75.6 88 50 72.9 24.4 88l6.2-29.5L8 37.6l29.6-4z" fill="#f7c948"/>`
    ),
  },
  {
    id: "sparkle",
    label: "Sparkle",
    category: "Stars",
    svg: svgUrl(
      `<path d="M50 4c3 24 12 33 12 33s-9 9-12 33c-3-24-12-33-12-33s9-9 12-33z" fill="#f7c948"/><path d="M22 46c1.8 14 7 19.6 7 19.6S23.8 70.8 22 84c-1.8-13.2-7-18.4-7-18.4S20.2 60 22 46z" fill="#f7c948"/><path d="M78 46c1.8 14 7 19.6 7 19.6S79.8 70.8 78 84c-1.8-13.2-7-18.4-7-18.4S76.2 60 78 46z" fill="#f7c948"/>`
    ),
  },
  {
    id: "moon-stars",
    label: "Moon & stars",
    category: "Stars",
    svg: svgUrl(
      `<path d="M62 8a44 44 0 1 0 0 84A44 44 0 0 1 62 8z" fill="#545e7e"/><path d="M74 22l3.2 8 8 3.2-8 3.2-3.2 8-3.2-8-8-3.2 8-3.2z" fill="#f7c948"/><path d="M88 52l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" fill="#f7c948"/>`
    ),
  },
  {
    id: "shooting-star",
    label: "Shooting star",
    category: "Stars",
    svg: svgUrl(
      `<path d="M4 96L44 56" stroke="#f7c948" stroke-width="6" stroke-linecap="round"/><path d="M18 92L44 66" stroke="#f7c948" stroke-width="4" stroke-linecap="round" opacity=".6"/><path d="M56 52l8.9 20L86 44.9 64.9 36 56 16 36 27.1 16 18l8.9 21.1L4 48l21.1 8.9z" fill="#f7c948"/>`
    ),
  },

  // ── Nature ────────────────────────────────────────────────
  {
    id: "flower-rose",
    label: "Rose",
    category: "Nature",
    svg: svgUrl(
      `<path d="M50 96c-1-20-6-34-16-44" stroke="#5d9c59" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M36 52c-8 2-14-2-16-8 6-4 13-3 16 8z" fill="#5d9c59"/><circle cx="50" cy="40" r="26" fill="#e8446a"/><circle cx="50" cy="40" r="18" fill="#f06e8c"/><circle cx="50" cy="40" r="10" fill="#f7a8bc"/><path d="M50 22a18 18 0 0 1 0 36 14 14 0 0 0 0-36z" fill="#d63859"/>`
    ),
  },
  {
    id: "flower-simple",
    label: "Flower",
    category: "Nature",
    svg: svgUrl(
      `<g fill="#f5a3c7"><circle cx="50" cy="26" r="16"/><circle cx="74" cy="45" r="16"/><circle cx="64" cy="72" r="16"/><circle cx="36" cy="72" r="16"/><circle cx="26" cy="45" r="16"/></g><circle cx="50" cy="50" r="12" fill="#f7c948"/><path d="M50 62c2 14 0 24-4 34" stroke="#5d9c59" stroke-width="5" fill="none" stroke-linecap="round"/>`
    ),
  },
  {
    id: "butterfly",
    label: "Butterfly",
    category: "Nature",
    svg: svgUrl(
      `<path d="M50 50C42 28 24 10 10 16c-8 20 14 40 36 40z" fill="#8ab8e0"/><path d="M50 50c8-22 26-40 40-34 8 20-14 40-36 40z" fill="#8ab8e0"/><path d="M50 52c-10 16-22 26-34 24-6-12 10-26 30-30z" fill="#b9d4ee"/><path d="M50 52c10 16 22 26 34 24 6-12-10-26-30-30z" fill="#b9d4ee"/><path d="M46 24c2-8 6-12 6-12s4 4 6 12" stroke="#646464" stroke-width="3" fill="none"/>`
    ),
  },
  {
    id: "sun",
    label: "Sun",
    category: "Nature",
    svg: svgUrl(
      `<circle cx="50" cy="50" r="24" fill="#f7c948"/><g stroke="#f7c948" stroke-width="6" stroke-linecap="round"><path d="M50 10v10M50 80v10M10 50h10M80 50h10M22 22l7 7M71 71l7 7M78 22l-7 7M29 71l-7 7"/></g>`
    ),
  },
  {
    id: "cloud",
    label: "Cloud",
    category: "Nature",
    svg: svgUrl(
      `<path d="M25 76a19 19 0 0 1-2-37.9A26 26 0 0 1 74 34a19 19 0 0 1 1 42z" fill="#e4e9f2"/>`
    ),
  },
  {
    id: "rainbow",
    label: "Rainbow",
    category: "Nature",
    svg: svgUrl(
      `<g fill="none" stroke-width="9" stroke-linecap="round"><path d="M12 84a38 38 0 0 1 76 0" stroke="#e8446a"/><path d="M21 84a29 29 0 0 1 58 0" stroke="#f7c948"/><path d="M30 84a20 20 0 0 1 40 0" stroke="#7cc47f"/><path d="M39 84a11 11 0 0 1 22 0" stroke="#8ab8e0"/></g>`
    ),
  },
  {
    id: "leaf",
    label: "Leaf",
    category: "Nature",
    svg: svgUrl(
      `<path d="M90 10C50 10 18 34 14 70c-1 8 0 16 2 22 6-30 26-52 58-64-30 16-48 38-54 68 34 6 68-22 70-86z" fill="#5d9c59"/>`
    ),
  },

  // ── Symbols ───────────────────────────────────────────────
  {
    id: "infinity",
    label: "Infinity",
    category: "Symbols",
    svg: svgUrl(
      `<path d="M30 50c-9-11-22-9-26 0s9 21 26 4c9-9 12-14 20-20 15-12 32-8 36 4s-9 22-26 8c-8-7-10-11-18-18-8-8-16-12-12 22z" fill="none" stroke="#e8446a" stroke-width="7" stroke-linecap="round" transform="scale(.9) translate(6 6)"/>`
    ),
  },
  {
    id: "peace",
    label: "Peace",
    category: "Symbols",
    svg: svgUrl(
      `<circle cx="50" cy="50" r="38" fill="none" stroke="#646464" stroke-width="7"/><path d="M50 12v76M50 50L24 72M50 50l26 22" stroke="#646464" stroke-width="7" stroke-linecap="round"/>`
    ),
  },
  {
    id: "crown",
    label: "Crown",
    category: "Symbols",
    svg: svgUrl(
      `<path d="M14 76l-4-48 24 18L50 16l16 30 24-18-4 48z" fill="#f7c948"/><rect x="14" y="76" width="72" height="10" rx="4" fill="#e0a93a"/>`
    ),
  },
  {
    id: "gift",
    label: "Gift",
    category: "Symbols",
    svg: svgUrl(
      `<rect x="16" y="38" width="68" height="50" rx="6" fill="#e8446a"/><rect x="10" y="26" width="80" height="18" rx="5" fill="#f06e8c"/><path d="M50 26v62" stroke="#f7c948" stroke-width="8"/><path d="M50 26c-14 0-22-4-22-10 0-5 4-8 8-8 7 0 11 8 14 18 3-10 7-18 14-18 4 0 8 3 8 8 0 6-8 10-22 10z" fill="none" stroke="#f7c948" stroke-width="5"/>`
    ),
  },
  {
    id: "envelope",
    label: "Love letter",
    category: "Symbols",
    svg: svgUrl(
      `<rect x="10" y="26" width="80" height="52" rx="6" fill="#fff" stroke="#c9b08a" stroke-width="4"/><path d="M10 32l40 30 40-30" fill="none" stroke="#c9b08a" stroke-width="4"/><path d="M50 58c-9-7-14-11-14-17 0-4.5 3.5-7.5 7-7.5 3 0 5.5 1.5 7 4 1.5-2.5 4-4 7-4 3.5 0 7 3 7 7.5 0 6-5 10-14 17z" fill="#e8446a"/>`
    ),
  },
  {
    id: "music-note",
    label: "Music note",
    category: "Symbols",
    svg: svgUrl(
      `<path d="M38 76a11 11 0 1 1-7-10V22l42-10v18L44 38v38z" fill="#646464"/><circle cx="82" cy="66" r="11" fill="#646464"/><path d="M38 30l42-10" stroke="#646464" stroke-width="7" stroke-linecap="round"/>`
    ),
  },
  {
    id: "camera",
    label: "Camera",
    category: "Symbols",
    svg: svgUrl(
      `<rect x="8" y="28" width="84" height="54" rx="10" fill="#3c3c3c"/><circle cx="50" cy="55" r="18" fill="#f3f3f3"/><circle cx="50" cy="55" r="11" fill="#8ab8e0"/><rect x="34" y="20" width="22" height="12" rx="4" fill="#3c3c3c"/><circle cx="78" cy="40" r="4" fill="#f7c948"/>`
    ),
  },
  {
    id: "location",
    label: "Location pin",
    category: "Symbols",
    svg: svgUrl(
      `<path d="M50 96S20 62 20 42a30 30 0 0 1 60 0c0 20-30 54-30 54z" fill="#e8446a"/><circle cx="50" cy="42" r="12" fill="#fff"/>`
    ),
  },
  {
    id: "chat-bubble",
    label: "Chat bubble",
    category: "Symbols",
    svg: svgUrl(
      `<path d="M14 20h72a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H52L32 88V70H14a8 8 0 0 1-8-8V28a8 8 0 0 1 8-8z" fill="#8ab8e0"/><g fill="#fff"><circle cx="34" cy="44" r="5"/><circle cx="50" cy="44" r="5"/><circle cx="66" cy="44" r="5"/></g>`
    ),
  },
  {
    id: "coffee",
    label: "Coffee date",
    category: "Symbols",
    svg: svgUrl(
      `<path d="M18 34h56v26a24 24 0 0 1-24 24H42A24 24 0 0 1 18 60z" fill="#c9a27e"/><path d="M74 40h6a10 10 0 0 1 0 20h-6" fill="none" stroke="#c9a27e" stroke-width="6"/><path d="M28 20c0-6 8-6 8-12M44 20c0-6 8-6 8-12M60 20c0-6 8-6 8-12" stroke="#b5b5b5" stroke-width="4" fill="none" stroke-linecap="round"/>`
    ),
  },

  // ── Decor ─────────────────────────────────────────────────
  {
    id: "confetti",
    label: "Confetti",
    category: "Decor",
    svg: svgUrl(
      `<g><rect x="12" y="14" width="10" height="18" rx="3" fill="#e8446a" transform="rotate(24 17 23)"/><rect x="76" y="10" width="10" height="18" rx="3" fill="#f7c948" transform="rotate(-18 81 19)"/><rect x="18" y="66" width="10" height="18" rx="3" fill="#7cc47f" transform="rotate(34 23 75)"/><rect x="70" y="64" width="10" height="18" rx="3" fill="#8ab8e0" transform="rotate(-28 75 73)"/><circle cx="50" cy="30" r="6" fill="#f5a3c7"/><circle cx="34" cy="52" r="5" fill="#f7c948"/><circle cx="66" cy="48" r="5" fill="#e8446a"/><path d="M50 62l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#8ab8e0"/></g>`
    ),
  },
  {
    id: "washi-hearts",
    label: "Washi tape",
    category: "Decor",
    svg: svgUrl(
      `<g transform="rotate(-8 50 50)"><rect x="-6" y="38" width="112" height="26" fill="#f5b8cf" opacity=".92"/><path d="M8 38v26M18 38v26M28 38v26M38 38v26M48 38v26M58 38v26M68 38v26M78 38v26M88 38v26" stroke="#fff" stroke-width="3" opacity=".7"/></g>`
    ),
  },
  {
    id: "banner",
    label: "Banner",
    category: "Decor",
    svg: svgUrl(
      `<path d="M10 24h80v40l-14-8-12 8-14-8-14 8-12-8-14 8z" fill="#f7c948"/><path d="M6 18h88v10H6z" fill="#e0a93a"/>`,
      "0 0 100 72"
    ),
  },
  {
    id: "frame-dots",
    label: "Dot frame",
    category: "Decor",
    svg: svgUrl(
      `<g fill="none" stroke="#e8446a" stroke-width="5" stroke-dasharray="0.1 14" stroke-linecap="round"><rect x="10" y="10" width="80" height="80" rx="8"/></g>`
    ),
  },
  {
    id: "frame-leaves",
    label: "Leaf wreath",
    category: "Decor",
    svg: svgUrl(
      `<g fill="#5d9c59"><path d="M50 8c-10 6-14 14-12 22 8 2 16-4 18-16zM50 8c10 6 14 14 12 22-8 2-16-4-18-16zM30 14c-10 3-16 10-16 18 7 3 16-1 20-12zM70 14c10 3 16 10 16 18-7 3-16-1-20-12zM18 32c-8 6-10 14-7 21 8 0 15-8 15-19zM82 32c8 6 10 14 7 21-8 0-15-8-15-19zM50 92c-10-6-14-14-12-22 8-2 16 4 18 16zM50 92c10-6 14-14 12-22-8-2-16 4-18 16zM30 86c-10-3-16-10-16-18 7-3 16 1 20 12zM70 86c10-3 16-10 16-18-7-3-16 1-20 12zM18 68c-8-6-10-14-7-21 8 0 15 8 15 19zM82 68c8-6 10-14 7-21-8 0-15 8-15 19z"/></g>`
    ),
  },
  {
    id: "paper-plane",
    label: "Paper plane",
    category: "Decor",
    svg: svgUrl(
      `<path d="M96 6 4 46l34 10 6 34 18-26 22 18z" fill="#f3f3f3" stroke="#646464" stroke-width="4" stroke-linejoin="round"/><path d="M96 6 42 70" stroke="#646464" stroke-width="3"/>`
    ),
  },
  {
    id: "balloon",
    label: "Balloon",
    category: "Decor",
    svg: svgUrl(
      `<path d="M50 14a30 30 0 0 1 30 30c0 18-16 34-30 34S20 62 20 44A30 30 0 0 1 50 14z" fill="#e8446a"/><path d="M46 76h8l-2 8h-4z" fill="#c9b08a"/><path d="M50 84c4 6 4 10-2 14" stroke="#c9b08a" stroke-width="3" fill="none"/><path d="M36 30c-6 4-9 10-9 16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`
    ),
  },
  {
    id: "birthday-cake",
    label: "Birthday cake",
    category: "Decor",
    svg: svgUrl(
      `<rect x="16" y="52" width="68" height="34" rx="6" fill="#f5b8cf"/><rect x="16" y="52" width="68" height="10" fill="#f06e8c"/><path d="M30 66v14M50 66v14M70 66v14" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M30 46v6M50 44v8M70 46v6" stroke="#646464" stroke-width="3"/><path d="M30 34c3 0 5 3 5 6a5 5 0 0 1-10 0c0-3 2-6 5-6zM50 32c3 0 5 3 5 6a5 5 0 0 1-10 0c0-3 2-6 5-6zM70 34c3 0 5 3 5 6a5 5 0 0 1-10 0c0-3 2-6 5-6z" fill="#f7c948"/>`
    ),
  },
];

export const STICKER_CATEGORIES = [
  "Hearts",
  "Stars",
  "Nature",
  "Symbols",
  "Decor",
] as const;

export function getSticker(id: string): StickerDef | undefined {
  return STICKERS.find((s) => s.id === id);
}

export function stickerSrc(id: string): string {
  return getSticker(id)?.svg ?? STICKERS[0].svg;
}

/** Built-in paper/texture page backgrounds (FR-12.4 templates, single-layer). */
export interface TemplateDef {
  id: string;
  label: string;
  category: "Plain" | "Gradient" | "Textured" | "Occasions";
  background: string; // page background hex or css gradient
  svg?: string; // optional foreground artwork layer
}

export const TEMPLATES: TemplateDef[] = [
  { id: "t-plain-white", label: "Plain paper", category: "Plain", background: "#FFFFFF" },
  { id: "t-plain-cream", label: "Cream paper", category: "Plain", background: "#FDF6EC" },
  { id: "t-plain-blush", label: "Blush paper", category: "Plain", background: "#FBEEF2" },
  { id: "t-plain-mist", label: "Mist paper", category: "Plain", background: "#EEF3F7" },
  {
    id: "t-grad-sunset",
    label: "Sunset",
    category: "Gradient",
    background: "linear-gradient(160deg,#FDF0E7 0%,#F9D9D2 45%,#F3B8C6 100%)",
  },
  {
    id: "t-grad-blossom",
    label: "Blossom",
    category: "Gradient",
    background: "linear-gradient(180deg,#FCE9F1 0%,#F7F9FC 100%)",
  },
  {
    id: "t-grad-mint",
    label: "Mint",
    category: "Gradient",
    background: "linear-gradient(200deg,#EAF6EF 0%,#F6FAF7 60%,#FDF6EC 100%)",
  },
  {
    id: "t-grad-night",
    label: "Starlit",
    category: "Gradient",
    background: "linear-gradient(180deg,#2E3250 0%,#545E7E 55%,#8A93B8 100%)",
  },
  {
    id: "t-occ-birthday",
    label: "Happy Birthday",
    category: "Occasions",
    background: "linear-gradient(180deg,#FFF7E8 0%,#FDEFF4 100%)",
    svg: svgUrl(
      `<g><text x="540" y="480" font-family="Georgia,serif" font-size="120" fill="#e8446a" text-anchor="middle">Happy</text><text x="540" y="620" font-family="Georgia,serif" font-size="120" fill="#e8446a" text-anchor="middle">Birthday!</text><g transform="translate(540 980)"><path d="M-16-70h32v16a8 8 0 0 1-2 6c-6 6-14 4-14-4z" fill="#f7c948" transform="translate(-120 0)"/><path d="M-16-70h32v16a8 8 0 0 1-2 6c-6 6-14 4-14-4z" fill="#f7c948" transform="translate(-40 0)"/><path d="M-16-70h32v16a8 8 0 0 1-2 6c-6 6-14 4-14-4z" fill="#f7c948" transform="translate(40 0)"/><path d="M-16-70h32v16a8 8 0 0 1-2 6c-6 6-14 4-14-4z" fill="#f7c948" transform="translate(120 0)"/></g><g fill="#e8446a" opacity=".8"><circle cx="180" cy="300" r="10"/><circle cx="900" cy="360" r="12"/><circle cx="240" cy="1500" r="12"/><circle cx="860" cy="1560" r="10"/><circle cx="120" cy="900" r="8"/><circle cx="960" cy="940" r="8"/></g></g>`,
      "0 0 1080 1920"
    ),
  },
  {
    id: "t-occ-love",
    label: "Love letter",
    category: "Occasions",
    background: "linear-gradient(180deg,#FBEEF2 0%,#FDF6EC 100%)",
    svg: svgUrl(
      `<g><g fill="#e8446a" opacity=".25"><path d="M180 260c-24-18-36-32-36-46 0-11 8-18 17-18 6 0 12 3 15 8 3-5 9-8 15-8 9 0 17 7 17 18 0 14-12 28-28 46z"/><path d="M900 1620c-24-18-36-32-36-46 0-11 8-18 17-18 6 0 12 3 15 8 3-5 9-8 15-8 9 0 17 7 17 18 0 14-12 28-28 46z"/></g><text x="540" y="880" font-family="Georgia,serif" font-style="italic" font-size="150" fill="#b34a63" text-anchor="middle">to:</text><text x="540" y="1060" font-family="Georgia,serif" font-style="italic" font-size="100" fill="#b34a63" text-anchor="middle">my favourite person</text></g>`,
      "0 0 1080 1920"
    ),
  },
  {
    id: "t-occ-thanks",
    label: "Thank you",
    category: "Occasions",
    background: "linear-gradient(180deg,#F4FAF6 0%,#FDF6EC 100%)",
    svg: svgUrl(
      `<g><g fill="#5d9c59" opacity=".3"><path d="M200 340c-30 4-48 20-48 40 22 4 44-8 56-32zM280 260c-4 30 8 50 28 56 6-22-6-46-28-56z" /></g><g fill="#5d9c59" opacity=".3"><path d="M830 1560c30-4 48-20 48-40-22-4-44 8-56 32zM750 1640c4-30-8-50-28-56-6 22 6 46 28 56z"/></g><text x="540" y="940" font-family="Georgia,serif" font-size="140" fill="#3f6b41" text-anchor="middle">Thank you</text><text x="540" y="1060" font-family="Georgia,serif" font-style="italic" font-size="72" fill="#6a9a6c" text-anchor="middle">from the bottom of my heart</text></g>`,
      "0 0 1080 1920"
    ),
  },
  {
    id: "t-occ-friend",
    label: "Best friends",
    category: "Occasions",
    background: "linear-gradient(180deg,#EEF3F7 0%,#FBEEF2 100%)",
    svg: svgUrl(
      `<g><text x="540" y="700" font-family="Georgia,serif" font-size="130" fill="#545e7e" text-anchor="middle">You &amp; Me</text><path d="M540 800c-40-30-60-52-60-74 0-18 13-29 27-29 10 0 25 8 33 22 8-14 23-22 33-22 14 0 27 11 27 29 0 22-20 44-60 74z" fill="#e8446a"/><text x="540" y="960" font-family="Georgia,serif" font-style="italic" font-size="70" fill="#8a93b8" text-anchor="middle">always, forever, every time</text></g>`,
      "0 0 1080 1920"
    ),
  },
];

export const TEMPLATE_CATEGORIES = [
  "Plain",
  "Gradient",
  "Textured",
  "Occasions",
] as const;
