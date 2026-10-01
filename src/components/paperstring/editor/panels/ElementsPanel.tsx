"use client";

/**
 * ElementsPanel (FR-11, FR-12) — the Elements Library: photo upload, built-in
 * stickers, PaperString paper art and page templates. Every insertion lands on
 * the active canvas as its own new active layer (FR-12.5).
 */

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { STICKERS, STICKER_CATEGORIES, TEMPLATES, stickerSrc } from "@/lib/paperstring/stickers";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupLabel, PanelShell } from "./shared";

const PAPER_ART = [1, 2, 3, 4, 5, 6].map((n) => ({
  src: `/showcase/page-${n}.png`,
  label: `Paper art ${n}`,
  w: 720,
  h: 1440,
}));

const MAX_UPLOAD = 12 * 1024 * 1024; // 12 MB

export function ElementsPanel() {
  const tool = useEditorStore((s) => s.tool);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const onPickPhoto = () => fileRef.current?.click();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image", {
        description: "Try a JPG, PNG, WebP or GIF photo.",
      });
      return;
    }
    if (file.size > MAX_UPLOAD) {
      toast.error("That photo is over 12 MB", {
        description: "Try a smaller or more compressed copy.",
      });
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setBusy(false);
        useEditorStore.getState().addImageLayer(src, img.naturalWidth, img.naturalHeight);
        useEditorStore.getState().setTool("select");
        toast.success("Photo added as a new layer");
      };
      img.onerror = () => {
        setBusy(false);
        toast.error("Could not read that image", {
          description: "The file may be damaged — try a different one.",
        });
      };
      img.src = src;
    };
    reader.onerror = () => {
      setBusy(false);
      toast.error("Could not read that file");
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addSticker = (id: string) => {
    useEditorStore.getState().addStickerLayer(id);
  };

  const addPaperArt = (art: (typeof PAPER_ART)[number]) => {
    useEditorStore.getState().addImageLayer(art.src, art.w, art.h);
    useEditorStore.getState().setTool("select");
    toast.success("Artwork added as a new layer");
  };

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    const { canvases, activeCanvasId, setBackground, addImageLayer, setTool } =
      useEditorStore.getState();
    const canvasId = activeCanvasId ?? canvases[0]?.id;
    if (!canvasId) return;
    setBackground(canvasId, t.background);
    if (t.svg) {
      // Template artwork lands full-bleed as one image layer (FR-12.6).
      const layer = addImageLayer(t.svg, 1080, 1920);
      useEditorStore.getState().updateLayer(layer.id, { scale: 1 });
    }
    setTool("select");
    toast.success(
      t.svg ? `“${t.label}” template applied` : `“${t.label}” background applied`
    );
  };

  return (
    <PanelShell
      title="Elements"
      hint="Everything you pick lands on this page as its own layer — photos, stickers, paper art and templates."
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {/* the upload dropzone — idle · drag-over · busy, with the file
          contract stated plainly underneath */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a photo — drop an image here or press Enter to browse"
        aria-disabled={busy}
        onClick={() => !busy && onPickPhoto()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            onPickPhoto();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) onFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          busy
            ? "cursor-wait border-editor-border bg-editor-raised/50"
            : dragOver
              ? "border-[#155EEF] bg-[#155EEF]/[0.05]"
              : "border-editor-border-strong bg-editor-raised/30 hover:border-[#155EEF]/50 hover:bg-[#155EEF]/[0.03]"
        )}
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-[#155EEF]" aria-hidden="true" />
            <p className="text-xs font-medium text-editor-text">Adding your photo…</p>
            <p className="text-[11px] text-editor-dim">It will land on the page as a new layer.</p>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg border transition-colors duration-150",
                dragOver
                  ? "border-[#155EEF]/40 bg-[#155EEF]/10 text-[#155EEF]"
                  : "border-editor-border-strong bg-editor-panel text-editor-dim"
              )}
            >
              <ImagePlus className="h-4.5 w-4.5" />
            </span>
            <p className="text-xs font-medium text-editor-text">
              {dragOver ? "Drop to add it" : "Drop a photo, or browse"}
            </p>
            <p className="text-[11px] leading-relaxed text-editor-dim">
              JPG · PNG · WebP · GIF — up to 12 MB
            </p>
          </>
        )}
      </div>

      <Tabs defaultValue={tool === "image" ? "art" : "stickers"}>
        <TabsList className="grid h-9 w-full grid-cols-3 rounded-lg bg-editor-raised p-0.5">
          <TabsTrigger
            value="stickers"
            className="rounded-md text-[11px] font-semibold data-[state=active]:bg-wash data-[state=active]:text-heart"
          >
            Stickers
          </TabsTrigger>
          <TabsTrigger
            value="art"
            className="rounded-md text-[11px] font-semibold data-[state=active]:bg-wash data-[state=active]:text-heart"
          >
            Paper art
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="rounded-md text-[11px] font-semibold data-[state=active]:bg-wash data-[state=active]:text-heart"
          >
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stickers" className="mt-3 flex flex-col gap-4">
          {STICKER_CATEGORIES.map((cat) => (
            <div key={cat} className="flex flex-col gap-2">
              <GroupLabel>{cat}</GroupLabel>
              <div className="grid grid-cols-4 gap-1.5">
                {STICKERS.filter((s) => s.category === cat).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.label}
                    aria-label={`Add ${s.label} sticker`}
                    onClick={() => addSticker(s.id)}
                    className="grid aspect-square place-items-center rounded-lg border border-editor-border p-1.5 transition hover:scale-105 hover:border-editor-border-strong hover:bg-editor-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#155EEF]"
                  >
                    <img
                      src={stickerSrc(s.id)}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="art" className="mt-3 flex flex-col gap-2">
          <GroupLabel>PaperString paper art</GroupLabel>
          <div className="grid grid-cols-3 gap-2">
            {PAPER_ART.map((art) => (
              <button
                key={art.src}
                type="button"
                aria-label={`Add ${art.label}`}
                onClick={() => addPaperArt(art)}
                className="overflow-hidden rounded-lg border border-editor-border transition hover:scale-[1.04] hover:border-editor-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#155EEF]"
              >
                <img
                  src={art.src}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="aspect-[9/16] w-full object-cover"
                />
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-editor-dim/80">
            Finished PaperString pages you can reuse as full-page artwork.
          </p>
        </TabsContent>

        <TabsContent value="templates" className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <GroupLabel>Page templates</GroupLabel>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Apply ${t.label} template`}
                  title={t.label}
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border border-editor-border transition",
                    "hover:scale-[1.04] hover:border-editor-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#155EEF]"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="block aspect-[9/16] w-full"
                    style={{ background: t.background }}
                  />
                  {t.svg && (
                    <img
                      src={t.svg}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wide text-white">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-editor-dim/80">
              Templates restyle this page’s background — occasion art lands as
              one layer you can still move or remove.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
