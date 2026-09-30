"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Eye,
  EyeOff,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

type AuthFormValues = {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
};

const authSchema = z
  .object({
    mode: z.enum(["signin", "signup"]),
    name: z.string().trim(),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Use at least 8 characters"),
  })
  .superRefine((values, ctx) => {
    // Name is only collected (and required) in signup mode.
    if (values.mode === "signup" && !values.name) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Tell us your name",
      });
    }
  });

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
          (any Google account works — the free tier is plenty).
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
            Enable Google sign-in
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-onyx/75">
            Google sign-in needs a free OAuth client ID from Google Cloud Console —
            a one-time setup that takes about two minutes. Here's exactly what to do:
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
            this page — the button activates automatically. Email sign-in keeps
            working the whole time.
          </AlertDescription>
        </Alert>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 w-full rounded-full"
          >
            Got it — use email for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Auth view ───────────────────────────────────────────────────────── */

export function AuthView({
  initialMode,
  returnHint,
}: {
  initialMode: "signin" | "signup";
  returnHint?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Google sign-in state: null = still checking /api/auth/config.
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [gisFailed, setGisFailed] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  // `mode` lives inside the form values so the resolver can validate
  // conditionally (name is only required in signup mode) without the
  // resolver identity ever needing to change.
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      mode: initialMode,
      name: "",
      email: "",
      password: "",
    },
  });

  const isSignup = mode === "signup";

  /* — Google: ask the server whether it's configured (the client id is
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

  /* — Shared success path: install user, leave for the dashboard — */
  const completeSignIn = useCallback(
    (user: PsUser, isNew: boolean) => {
      queryClient.setQueryData<{ user: PsUser | null }>(["me"], { user });
      toast.success(
        isNew ? "Your studio is ready" : "Welcome back to your studio"
      );
      psNavigate("dashboard");
    },
    [queryClient]
  );

  /* — Google: mount the real GIS button when configured — */
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
                completeSignIn(json.user, false);
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
    const url = `${window.location.pathname}?view=auth&mode=${mode}`;
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

  const toggleMode = () => {
    const next: AuthMode = isSignup ? "signin" : "signup";
    setMode(next);
    setValue("mode", next);
    setServerError(null);
    clearErrors("name");
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch(
        isSignup ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSignup
              ? {
                  name: values.name.trim(),
                  email: values.email,
                  password: values.password,
                }
              : { email: values.email, password: values.password }
          ),
        }
      );

      let json: { user?: PsUser; error?: string } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok || !json?.user) {
        const message =
          json?.error ??
          (res.ok
            ? "Something went wrong — please try again"
            : `Couldn't ${isSignup ? "create your account" : "sign you in"} — please try again`);
        setServerError(message);
        toast.error(message);
        return;
      }

      // Install the authenticated user straight from the auth response —
      // same shape as /api/auth/me — and leave for the dashboard immediately.
      // No refetch round-trip means no window for the auth guard to bounce
      // us back to this page (the old "success toast but stuck here" bug).
      completeSignIn(json.user, isSignup);
    } catch {
      const message =
        "Couldn't reach the studio — check your connection and try again";
      setServerError(message);
      toast.error(message);
    }
  });

  return (
    <MotionConfig reducedMotion="user">
      {/* ── Single centered form (brand panel removed — form stays a
          centered, narrow column, the pattern serious products use for
          auth screens) ─────────────────────────────────────────────── */}
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
            {isSignup ? "Create your studio" : "Welcome back"}
          </h1>
          <p className="mt-2.5 text-sm text-onyx/75">
            {isSignup
              ? "Free forever. Make someone's day."
              : "Sign in to keep creating."}
          </p>

          {returnHint && (
            <Alert className="mt-5 border-silver/50 bg-card/60 py-2.5">
              <Info className="size-4 text-dim" />
              <AlertDescription className="text-xs text-dim">
                Sign in to get back to your project.
              </AlertDescription>
            </Alert>
          )}

          {/* ── Google sign-in ────────────────────────────────────────
              Real GIS button when configured; a setup guide otherwise;
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
                <GoogleMark />
                Continue with Google
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
              </Button>
            )}
          </div>

          <div className="my-7 flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-dim">
              or continue with email
            </span>
            <Separator className="flex-1" />
          </div>

          {serverError && (
            <Alert
              variant="destructive"
              className="mb-5 animate-in fade-in slide-in-from-top-1"
            >
              <AlertDescription className="text-sm">
                {serverError}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  autoFocus
                  className="h-11 rounded-xl border-silver/60 bg-paper shadow-none focus-visible:border-night/50"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  {...register("name")}
                />
                {errors.name && (
                  <p id="name-error" className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 rounded-xl border-silver/60 bg-paper shadow-none focus-visible:border-night/50"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="pr-12 h-11 rounded-xl border-silver/60 bg-paper shadow-none focus-visible:border-night/50"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-dim transition-colors hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-full"
            >
              {isSubmitting && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {isSubmitting
                ? isSignup
                  ? "Creating your studio…"
                  : "Signing in…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-dim">
            {isSignup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-semibold text-night underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {isSignup ? (
                "Sign in"
              ) : (
                <>
                  Create an account
                  <ArrowRight
                    className="ml-0.5 inline h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </p>

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
