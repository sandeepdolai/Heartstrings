"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { LogoMark, WordMark } from "@/components/paperstring/brand";
import { cn } from "@/lib/utils";
import { PaperFlip, type PaperFlipHandle } from "./PaperFlip";
/* ── data ───────────────────────────────────────────────────────────────── */

interface ShareData {
  title: string;
  pages: string[];
}

/** Special demo token: a local book so QA can exercise the flip pre-publish. */
const DEMO_BOOK: ShareData = {
  title: "A little book of feelings",
  pages: [
    "/showcase/page-1.png",
    "/showcase/page-2.png",
    "/showcase/page-3.png",
    "/showcase/page-4.png",
    "/showcase/page-5.png",
    "/showcase/page-6.png",
  ],
};

/** Framer-compatible copy of --ease-flip. */
const EASE_FLIP: [number, number, number, number] = [0.22, 0.9, 0.32, 1];

/* ── view ───────────────────────────────────────────────────────────────── */

export function ViewerView({ shareToken }: { shareToken: string }) {
  const isDemo = shareToken === "demo";

  const { data, isLoading, isError } = useQuery<ShareData>({
    queryKey: ["share", shareToken],
    queryFn: async (): Promise<ShareData> => {
      if (isDemo) return DEMO_BOOK;
      const res = await fetch(`/api/share/${encodeURIComponent(shareToken)}`);
      if (!res.ok) throw new Error(`This link is unavailable (${res.status}).`);
      return res.json();
    },
    staleTime: Infinity,
    retry: 1,
    // Demo resolves locally with no network and no loading flash.
    ...(isDemo ? { initialData: DEMO_BOOK } : {}),
  });

  if (isLoading) return <ViewerLoading />;

  // 404, failed fetch, or a payload without pages — all the same warm,
  // non-technical dead end (Flow 4.8). No retries, no editing, no promos.
  const unavailable =
    isError ||
    !data ||
    !Array.isArray(data.pages) ||
    data.pages.length === 0 ||
    data.pages.some((p) => typeof p !== "string" || !p);

  if (unavailable) return <ViewerUnavailable />;

  return (
    <ViewerBook key={shareToken} title={data.title || "Untitled"} pages={data.pages} />
  );
}

/* ── loading ────────────────────────────────────────────────────────────── */

function ViewerLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-night px-6">
      <WordMark className="text-silver" markClassName="h-6 w-7" />
      {/* page-sized placeholder — aspect reserved, so no layout shift later */}
      <div
        className="h-[60vh] w-auto animate-pulse rounded-xl bg-onyx/40 aspect-[9/16]"
        style={{ animationDuration: "2.8s" }}
      />
      <p className="text-xs uppercase tracking-widest text-dim">
        Opening your book…
      </p>
    </main>
  );
}

/* ── unavailable (Flow 4.8) ─────────────────────────────────────────────── */

function ViewerUnavailable() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-night px-6 text-center">
      <LogoMark className="h-10 w-11 text-silver" strokeWidth={3.2} />
      <h1 className="mt-7 font-display text-2xl text-smoke">
        This book isn&rsquo;t available
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-dim">
        The link may have been revoked, or the book was never shared. Ask the
        sender for a fresh link.
      </p>
      <WordMark
        className="absolute bottom-6 gap-1.5 text-smoke/35"
        markClassName="h-3.5 w-4"
      />
    </main>
  );
}

/* ── the book (success) ─────────────────────────────────────────────────── */

function ViewerBook({ title, pages }: { title: string; pages: string[] }) {
  const reduced = useReducedMotion() ?? false;
  const flipRef = useRef<PaperFlipHandle>(null);
  const [index, setIndex] = useState(0);
  const [titleDimmed, setTitleDimmed] = useState(false);
  const single = pages.length <= 1;

  // The title arrives bright, then recedes after 3s; hover/focus restores it.
  useEffect(() => {
    const t = window.setTimeout(() => setTitleDimmed(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  // Global arrow-key paging (Flow 4.4): keys work whichever chrome element
  // holds focus — the chevrons, the title, or the book region itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        flipRef.current?.next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        flipRef.current?.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="ps-grain relative flex h-screen flex-col overflow-hidden bg-night text-smoke supports-[height:100dvh]:h-dvh">
      {/* soft radial vignette over the gallery */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_42%,transparent_38%,rgba(0,0,0,0.3)_75%,rgba(0,0,0,0.6)_100%)]"
      />

      {/* top — title, small caps */}
      <header className="group relative z-10 flex h-16 shrink-0 items-center justify-center px-4">
        <motion.h1
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0.2 : 0.7, ease: EASE_FLIP }}
          className={cn(
            "max-w-[70vw] truncate text-center text-xs uppercase tracking-[0.25em] transition-colors duration-700",
            titleDimmed
              ? "text-silver/40 group-hover:text-silver/80 group-focus-within:text-silver/80"
              : "text-silver/80"
          )}
        >
          {title}
        </motion.h1>
      </header>

      {/* center — the book */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-x-clip px-4">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.965 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduced ? 0.2 : 0.55, ease: EASE_FLIP }}
        >
          <PaperFlip
            ref={flipRef}
            pages={pages}
            title={title}
            onIndexChange={setIndex}
          />
        </motion.div>

        {/* view-only navigation (SEP-2); zones + swipe carry touch screens */}
        {!single && (
          <>
            <button
              type="button"
              aria-label="Previous page"
              disabled={index === 0}
              onClick={() => flipRef.current?.prev()}
              className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-silver/70 transition-colors duration-200 hover:bg-white/5 hover:text-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-silver/70 disabled:pointer-events-none disabled:opacity-30 md:grid"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={index === pages.length - 1}
              onClick={() => flipRef.current?.next()}
              className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-silver/70 transition-colors duration-200 hover:bg-white/5 hover:text-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-silver/70 disabled:pointer-events-none disabled:opacity-30 md:grid"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* bottom — page position (single-page books get a quiet dedication) */}
      <footer className="relative z-10 flex h-16 shrink-0 flex-col items-center justify-center gap-2">
        {single ? (
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-dim">
            for you
            <Heart
              className="h-2.5 w-2.5 text-dim"
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
          </p>
        ) : (
          <>
            <p className="text-xs tabular-nums text-dim">
              {index + 1} / {pages.length}
            </p>
            {pages.length <= 12 && (
              <div aria-hidden="true" className="flex items-center gap-1.5">
                {pages.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                      i === index ? "bg-silver" : "bg-onyx"
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </footer>

      {/* the accessible source of truth for page position */}
      <div aria-live="polite" className="sr-only">
        Page {Math.min(index + 1, pages.length)} of {pages.length}
      </div>
    </main>
  );
}
