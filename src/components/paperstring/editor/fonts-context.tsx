"use client";

/**
 * Runtime registry of creator-imported fonts (FR-4.4). The editor owns the
 * list; the TextPanel consumes it. Fonts are registered as FontFaces on the
 * document and persisted (data URL) inside ProjectData so they survive reload.
 */

import { createContext, useContext } from "react";
import type { CustomFont } from "@/lib/paperstring/types";

export interface EditorFontsApi {
  fonts: CustomFont[];
  /** Register + persist a new font. Throws with a friendly message on failure. */
  addFont: (font: CustomFont) => void;
}

const EditorFontsContext = createContext<EditorFontsApi | null>(null);

export function EditorFontsProvider({
  value,
  children,
}: {
  value: EditorFontsApi;
  children: React.ReactNode;
}) {
  return (
    <EditorFontsContext.Provider value={value}>
      {children}
    </EditorFontsContext.Provider>
  );
}

export function useEditorFonts(): EditorFontsApi {
  return (
    useContext(EditorFontsContext) ?? {
      fonts: [],
      addFont: () => {},
    }
  );
}

/** Register one custom font as a document FontFace. Resolves when usable. */
export async function registerFontFace(font: CustomFont): Promise<void> {
  const buf = await (await fetch(font.src)).arrayBuffer();
  const face = new FontFace(font.family, buf);
  await face.load();
  document.fonts.add(face);
}

/** Register every saved font (editor load path). Failures are swallowed —
 * layers referencing an unavailable font fall back to sans-serif visually. */
export async function registerSavedFonts(fonts: CustomFont[]): Promise<void> {
  await Promise.all(
    fonts.map((f) =>
      registerFontFace(f).catch((err) => {
        console.warn(`[fonts] could not restore "${f.label}"`, err);
      })
    )
  );
}

/** Read a font file into a CustomFont (validates type + size). */
export async function importFontFile(file: File): Promise<CustomFont> {
  const ok = /\.(ttf|otf|woff2?)$/i.test(file.name) || /^font\//.test(file.type);
  if (!ok) {
    throw new Error("Only .ttf, .otf, .woff and .woff2 fonts are supported");
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("That font is over 6 MB — try a smaller file");
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const mime = file.type || "font/ttf";
  const label = file.name.replace(/\.(ttf|otf|woff2?)$/i, "").slice(0, 40) || "My font";
  const id = `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    label,
    family: `PsCustom-${id}`,
    src: `data:${mime};base64,${btoa(bin)}`,
  };
}
