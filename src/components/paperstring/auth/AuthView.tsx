"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";

import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { WordMark } from "@/components/paperstring/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * PaperString auth — Google only (round 26).
 *
 * Email/password sign-up and sign-in were removed on purpose: one tap with
 * the Google account everyone already has, zero passwords to store or reset,
 * zero mail infrastructure to pay for. Existing email accounts (and their
 * projects) are untouched — signing in with the same Google email links to
 * them automatically (see /api/auth/google's find-or-link logic).
 */

/** Google "G" brand mark — the one sanctioned use of color (official brand logo). */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4", className)}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

/* ── Google Identity Services (minimal typings for the bits we use) ──── */

interface GisCredentialResponse {
  credential?: string;
}

interface GisIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GisCredentialResponse) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      shape?: string;
      text?: string;
      logo_alignment?: string;
      width?: number;
    }
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GisIdApi } };
  }
}

const GIS_SCRIPT_ID = "ps-google-gis";

/** Inject the official GIS script once, resolve when window.google is live. */
function loadGoogleGis(): Promise<GisIdApi> {
  return new Promise((resolve, reject) => {
    const waitForApi = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
        return true;
      }
      return false;
    };

    if (waitForApi()) return;

    if (!document.getElementById(GIS_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = GIS_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error("Failed to load Google sign-in"));
      document.head.appendChild(script);
    }

    // Script may already be loading (or cached) — poll briefly for the API.
    let tries = 0;
    const timer = window.setInterval(() => {
      if (waitForApi()) {
        window.clearInterval(timer);
      } else if (++tries > 60) {
        window.clearInterval(timer);
        reject(new Error("Google sign-in took too long to load"));
      }
    }, 100);
  });
}

/* ── Setup dialog (shown when GOOGLE_CLIENT_ID isn't configured) ────── */

function OriginChip({ origin }: { origin: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy"
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-silver/60 bg-paper px-2.5 py-1 font-mono text-xs text-night transition-colors hover:border-night/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="truncate">{origin}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-dim" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy origin"}</span>
    </button>
  );
}

function GoogleSetupDialog({
  open,
  onOpenChange,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
}) {
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: "Open Google Cloud Console",
      body: (
        <>
          Go to{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-night underline underline-offset-4 hover:text-onyx"
          >
            APIs &amp; Services → Credentials
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>{" "}
          with any Google account — it's free, no credit card needed.
        </>
      ),
    },
    {
      title: "Create an OAuth client ID",
      body: (
        <>
          <strong className="font-semibold">Create credentials → OAuth client ID</strong>{" "}
          → choose <strong className="font-semibold">Web application</strong>. If asked,
          configure the consent screen first (External, app name, your email).
        </>
      ),
    },
    {
      title: "Authorize this app's origin",
      body: (
        <>
          Under <strong className="font-semibold">Authorized JavaScript origins</strong>,
          add exactly this origin — https included, no trailing slash:
          <span className="mt-1.5 block">
            <OriginChip origin={origin} />
          </span>
        </>
      ),
    },
    {
      title: "Add the client ID to your environment",
      body: (
        <>
          Copy the Client ID (it looks like{" "}
          <code className="rounded bg-smoke px-1 py-0.5 font-mono text-[11px]">
            1234…apps.googleusercontent.com
          </code>
          ) and set it as{" "}
          <code className="rounded bg-smoke px-1 py-0.5 font-mono text-[11px]">
            GOOGLE_CLIENT_ID
          </code>{" "}
          in <code className="font-mono text-[11px]">.env</code>, then restart the app.
        </>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-2xl p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <GoogleMark />
            Connect Google sign-in
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-onyx/75">
            Google sign-in is the only way into PaperString, so it needs a free
            OAuth client ID before anyone can sign in — a one-time setup that
            takes about two minutes. Here's exactly what to do:
          </DialogDescription>
        </DialogHeader>

        <ol className="mt-5 space-y-4">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-night text-xs font-semibold text-smoke"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-onyx/75">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <Alert className="mt-5 border-silver/50 bg-card/60 py-2.5">
          <Info className="size-4 text-dim" />
          <AlertDescription className="text-xs text-dim">
            After adding <code className="font-mono">GOOGLE_CLIENT_ID</code>, reload
            this page — the button activates automatically. Existing accounts
            aren't lost: signing in with the same Google email links to them
            (and all their projects) automatically.
          </AlertDescription>
        </Alert>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 w-full rounded-full"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Auth view ───────────────────────────────────────────────────────── */

export function AuthView({ returnHint }: { returnHint?: boolean }) {
  // Google sign-in state: null = still checking /api/auth/config.
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [gisFailed, setGisFailed] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  /* — Ask the server whether Google is configured (the client id is
     public by design — Google's SDK needs it on the frontend) — */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/config")
      .then((res) => (res.ok ? res.json() : { googleEnabled: false }))
      .then((cfg: { googleEnabled?: boolean; googleClientId?: string | null }) => {
        if (cancelled) return;
        setGoogleEnabled(!!cfg.googleEnabled);
        setGoogleClientId(cfg.googleClientId ?? null);
      })
      .catch(() => {
        if (!cancelled) setGoogleEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* — Success path: install user, leave for the dashboard — */
  const completeSignIn = useCallback(
    (user: PsUser) => {
      queryClient.setQueryData<{ user: PsUser | null }>(["me"], { user });
      toast.success("Welcome back to your studio");
      psNavigate("dashboard");
    },
    [queryClient]
  );

  /* — Mount the real GIS button when configured — */
  useEffect(() => {
    if (googleEnabled !== true || !googleClientId) return;
    let cancelled = false;

    loadGoogleGis()
      .then((idApi) => {
        if (cancelled) return;

        idApi.initialize({
          client_id: googleClientId,
          callback: (response) => {
            // Defensive: never trust an empty credential from the DOM.
            const credential = response.credential;
            if (!credential) {
              toast.error("Google sign-in was cancelled — please try again");
              return;
            }
            setGooglePending(true);
            fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            })
              .then(async (res) => {
                let json: { user?: PsUser; error?: string } | null = null;
                try {
                  json = await res.json();
                } catch {
                  json = null;
                }
                if (!res.ok || !json?.user) {
                  throw new Error(
                    json?.error ?? "Google sign-in didn't complete — try again"
                  );
                }
                completeSignIn(json.user);
              })
              .catch((err: Error) => {
                toast.error(err.message);
              })
              .finally(() => setGooglePending(false));
          },
        });

        const host = googleBtnRef.current;
        if (host) {
          const width = Math.max(220, Math.floor(host.clientWidth) || 320);
          idApi.renderButton(host, {
            theme: "outline",
            size: "large",
            shape: "pill",
            text: "continue_with",
            logo_alignment: "left",
            width,
          });

          // Cross-site iframes (like the sandbox preview panel) can't host
          // Google's button — if nothing rendered after a moment, swap in our
          // own fallback that opens the app in a full browser tab.
          window.setTimeout(() => {
            if (!cancelled && host.childElementCount === 0) {
              setGisFailed(true);
            }
          }, 2500);
        }
      })
      .catch(() => {
        if (!cancelled) setGisFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [googleEnabled, googleClientId, completeSignIn]);

  /** Fallback for contexts where Google's own button can't run (iframes). */
  const openGoogleInFullTab = () => {
    const url = `${window.location.pathname}?view=auth`;
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      toast.info(
        "Google's button can't run inside this embedded preview — use the “Open in New Tab” button above the preview, then choose Continue with Google.",
        { duration: 8000 }
      );
    } else {
      toast.info(
        "We've opened the app in a full browser tab — finish Google sign-in there.",
        { duration: 6000 }
      );
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* ── Single centered card — Google is the one and only way in,
          so the page is a calm, focused moment: mark, message, button. */}
      <main className="flex min-h-screen items-center justify-center bg-smoke ps-grain p-6 sm:p-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 flex justify-center">
            <WordMark className="text-night" />
          </div>

          <h1 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2.5 text-sm text-onyx/75">
            Sign in with Google — the one account you already have. No
            passwords, no hassle.
          </p>

          {returnHint && (
            <Alert className="mt-5 border-silver/50 bg-card/60 py-2.5">
              <Info className="size-4 text-dim" />
              <AlertDescription className="text-xs text-dim">
                Sign in to get back to your project.
              </AlertDescription>
            </Alert>
          )}

          {/* ── Google sign-in — the only button on the page ──────────
              Real GIS button when configured; a setup guide until then;
              a full-tab fallback where iframes block Google's UI. */}
          <div className="mt-8">
            {googleEnabled === null ? (
              <div
                aria-hidden="true"
                className="h-11 w-full animate-pulse rounded-full bg-silver/30"
              />
            ) : googleEnabled && !gisFailed ? (
              <div className="flex min-h-11 w-full justify-center">
                <div ref={googleBtnRef} />
              </div>
            ) : googleEnabled && gisFailed ? (
              <Button
                type="button"
                variant="outline"
                disabled={googlePending}
                onClick={openGoogleInFullTab}
                className="h-11 w-full rounded-full border-silver/60 bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                {googlePending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GoogleMark />
                )}
                {googlePending ? "Signing you in…" : "Continue with Google"}
                <ExternalLink className="size-3.5 text-dim" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSetupOpen(true)}
                className="h-11 w-full rounded-full border-silver/60 bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                <GoogleMark />
                Continue with Google
                <ArrowRight className="size-3.5 text-dim" aria-hidden="true" />
              </Button>
            )}
          </div>

          {googleEnabled === false && (
            <Alert className="mt-5 animate-in fade-in slide-in-from-top-1 border-silver/50 bg-card/60 py-2.5">
              <Info className="size-4 text-dim" />
              <AlertDescription className="text-xs text-dim">
                Google sign-in isn't connected on this deployment yet — it's a
                free, one-time setup.{" "}
                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="font-semibold text-night underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Show the 2-minute setup
                </button>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => psNavigate("landing")}
              className="text-xs text-dim transition-colors hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              ← Back to home
            </button>
          </div>
        </motion.div>
      </main>

      <GoogleSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        origin={
          typeof window === "undefined" ? "https://your-app-domain" : window.location.origin
        }
      />
    </MotionConfig>
  );
}
