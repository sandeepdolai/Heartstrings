/**
 * Export — save every created page as real image files (PNG + JPG).
 *
 * Renders through the same engine that bakes 4K publish masters, so the
 * files are pixel-identical to what a recipient flips through: fonts,
 * stickers, masks, blends and photo adjustments all included.
 */

import { PUBLISH_SCALE, type CanvasPageData } from "./types";
import { renderPageToCanvas } from "./render";

export type ExportFormat = "png" | "jpg";

const JPG_QUALITY = 0.92;

/** Trigger one browser download from a data URL (no network, no blob URLs). */
function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** File-system-safe base name from the book title. */
export function sanitizeFileBase(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "paperstring";
}

/**
 * Render pages and download each as PNG and/or JPG. Returns the number of
 * files written. Downloads are paced ~80ms apart so browsers queue them in
 * order instead of choking on a burst.
 */
export async function exportPagesAsImages(opts: {
  title: string;
  pages: CanvasPageData[];
  formats: ExportFormat[];
  /** Device pixels per canvas unit (default: the 4K publish scale). */
  scale?: number;
}): Promise<number> {
  const { title, pages, formats } = opts;
  if (!pages.length || !formats.length) return 0;
  const scale = opts.scale ?? PUBLISH_SCALE;
  const base = sanitizeFileBase(title);
  let written = 0;
  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPageToCanvas(pages[i], scale);
    const suffix = pages.length > 1 ? `-page-${i + 1}` : "";
    for (const format of formats) {
      const url =
        format === "png"
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", JPG_QUALITY);
      downloadDataUrl(url, `${base}${suffix}.${format}`);
      written++;
      await new Promise((r) => setTimeout(r, 80));
    }
  }
  return written;
}
