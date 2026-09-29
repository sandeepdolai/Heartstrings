"use client";

/**
 * Shared primitives for the editor tool panels.
 */

import { useEffect, useRef } from "react";
import { useEditorStore, type HistoryEntry } from "@/lib/paperstring/editor-store";
import type { Layer } from "@/lib/paperstring/types";
import { Slider } from "@/components/ui/slider";

/** The active layer of the active canvas (or null). */
export function useActiveLayer(): Layer | null {
  return useEditorStore((s) => {
    const c = s.canvases.find((c) => c.id === s.activeCanvasId);
    const id = c ? s.activeLayerIds[c.id] : undefined;
    return c?.layers.find((l) => l.id === id) ?? null;
  });
}

export function PanelShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-editor-dim">
          {title}
        </h2>
        {hint && (
          <p className="mt-1 text-xs leading-relaxed text-editor-dim/80">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-editor-text">{label}</span>
        <span className="tabular-nums text-editor-dim">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        onValueCommit={onCommit ? (v) => onCommit(v[0]) : undefined}
        aria-label={label}
        className="text-editor-dim"
      />
    </div>
  );
}

/**
 * Live-gesture edit helper for layer properties: slider drags update the layer
 * with no history entries; the pre-gesture snapshot is pushed as ONE undo
 * entry on commit.
 */
export function useLayerLiveEdit(layerId: string | null) {
  const snapRef = useRef<HistoryEntry | null>(null);
  useEffect(() => {
    // a different layer (or none) — drop any dangling snapshot
    return () => {
      snapRef.current = null;
    };
  }, [layerId]);

  const beginLive = () => {
    if (!snapRef.current) snapRef.current = useEditorStore.getState().captureHistory();
  };
  const live = (patch: Record<string, unknown>) => {
    if (layerId)
      useEditorStore.getState().updateLayer(layerId, patch, { history: false });
  };
  const endLive = () => {
    const snap = snapRef.current;
    snapRef.current = null;
    if (snap) useEditorStore.getState().pushHistory(snap);
  };
  return { beginLive, live, endLive };
}

/** Tiny labelled control group header. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-editor-dim/70">
      {children}
    </p>
  );
}
