/**
 * PaperString creative font collection (FR-4.3).
 * Google Fonts are linked inside the editor; each entry maps a display name
 * to the exact CSS font-family string used on canvas and in DOM previews.
 */

export interface FontDef {
  id: string;
  label: string;
  cssFamily: string;
  category: "Script" | "Serif" | "Sans" | "Display" | "Handwriting";
}

export const CREATIVE_FONTS: FontDef[] = [
  { id: "fraunces", label: "Fraunces", cssFamily: "Fraunces", category: "Serif" },
  { id: "playfair", label: "Playfair Display", cssFamily: "'Playfair Display'", category: "Serif" },
  { id: "lora", label: "Lora", cssFamily: "Lora", category: "Serif" },
  { id: "cormorant", label: "Cormorant Garamond", cssFamily: "'Cormorant Garamond'", category: "Serif" },
  { id: "abril", label: "Abril Fatface", cssFamily: "'Abril Fatface'", category: "Display" },
  { id: "bebas", label: "Bebas Neue", cssFamily: "'Bebas Neue'", category: "Display" },
  { id: "poppins", label: "Poppins", cssFamily: "Poppins", category: "Sans" },
  { id: "raleway", label: "Raleway", cssFamily: "Raleway", category: "Sans" },
  { id: "inter", label: "Inter", cssFamily: "Inter", category: "Sans" },
  { id: "dancing", label: "Dancing Script", cssFamily: "'Dancing Script'", category: "Script" },
  { id: "greatvibes", label: "Great Vibes", cssFamily: "'Great Vibes'", category: "Script" },
  { id: "sacramento", label: "Sacramento", cssFamily: "Sacramento", category: "Script" },
  { id: "pacifico", label: "Pacifico", cssFamily: "Pacifico", category: "Script" },
  { id: "lobster", label: "Lobster", cssFamily: "Lobster", category: "Script" },
  { id: "caveat", label: "Caveat", cssFamily: "Caveat", category: "Handwriting" },
  { id: "shadows", label: "Shadows Into Light", cssFamily: "'Shadows Into Light'", category: "Handwriting" },
  { id: "indie", label: "Indie Flower", cssFamily: "'Indie Flower'", category: "Handwriting" },
  { id: "gloria", label: "Gloria Hallelujah", cssFamily: "'Gloria Hallelujah'", category: "Handwriting" },
  { id: "amatic", label: "Amatic SC", cssFamily: "'Amatic SC'", category: "Handwriting" },
  { id: "rock", label: "Rock Salt", cssFamily: "'Rock Salt'", category: "Handwriting" },
  { id: "permanent", label: "Permanent Marker", cssFamily: "'Permanent Marker'", category: "Handwriting" },
  { id: "fredoka", label: "Fredoka", cssFamily: "Fredoka", category: "Sans" },
];

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Abril+Fatface",
    "family=Amatic+SC:wght@400;700",
    "family=Bebas+Neue",
    "family=Caveat:wght@400;600;700",
    "family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400",
    "family=Dancing+Script:wght@400;700",
    "family=Fredoka:wght@400;600",
    "family=Gloria+Hallelujah",
    "family=Great+Vibes",
    "family=Indie+Flower",
    "family=Inter:wght@400;500;600;700",
    "family=Lobster",
    "family=Lora:ital,wght@0,400;0,600;1,400",
    "family=Pacifico",
    "family=Permanent+Marker",
    "family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400",
    "family=Poppins:wght@400;500;600",
    "family=Raleway:wght@400;600",
    "family=Rock+Salt",
    "family=Sacramento",
    "family=Shadows+Into+Light",
  ].join("&") +
  "&display=swap";

let fontsLinked = false;

/** Idempotently mount the creative-font stylesheet (editor/viewer only). */
export function ensureCreativeFonts(): void {
  if (fontsLinked || typeof document === "undefined") return;
  if (document.getElementById("ps-creative-fonts")) {
    fontsLinked = true;
    return;
  }
  const link = document.createElement("link");
  link.id = "ps-creative-fonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
  fontsLinked = true;
}

/** Force-load a font so <canvas> can measure/draw it (returns when ready). */
export async function loadFontForCanvas(cssFamily: string): Promise<void> {
  if (typeof document === "undefined") return;
  ensureCreativeFonts();
  try {
    await document.fonts.load(`72px ${cssFamily}`);
    await document.fonts.load(`700 72px ${cssFamily}`);
  } catch {
    /* font may not exist — canvas falls back to next family */
  }
}
