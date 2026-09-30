"use client";

import { useState } from "react";
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
import { Eye, EyeOff, Info, Loader2 } from "lucide-react";

import { psNavigate } from "@/lib/paperstring/navigation";
import { WordMark } from "@/components/paperstring/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const [showcaseIdx, setShowcaseIdx] = useState(0);

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

      let json: { user?: unknown; error?: string } | null = null;
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

      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(
        isSignup ? "Your studio is ready" : "Welcome back to your studio"
      );
      psNavigate("dashboard");
    } catch {
      const message =
        "Couldn't reach the studio — check your connection and try again";
      setServerError(message);
      toast.error(message);
    }
  });

  // Showcase art with a graceful chain: png → jpg → small-caps microcopy.
  const showcaseSources = ["/showcase/page-4.png", "/showcase/page-4.jpg"];
  const showcaseSrc = showcaseSources[showcaseIdx];

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen bg-smoke ps-grain">
        {/* ── Left brand panel (desktop) ─────────────────────────────── */}
        <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-night p-12 text-smoke lg:flex">
          <WordMark className="text-smoke" />

          <div className="py-12">
            <blockquote className="font-display text-[2.6rem] leading-[1.15] font-medium tracking-tight text-balance">
              &ldquo;Anyone can make something{" "}
              <em className="italic">beautiful</em> for someone they{" "}
              <em className="italic">love</em>.&rdquo;
            </blockquote>
            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-silver/80">
              — the PaperString promise
            </p>
          </div>

          {showcaseSrc ? (
            <div className="group relative w-fit">
              {/* soft paper glow behind the tilted page */}
              <div
                aria-hidden="true"
                className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(181,181,181,0.14),transparent)] opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
              />
              <img
                src={showcaseSrc}
                alt="A handmade PaperString page"
                decoding="async"
                onError={() => setShowcaseIdx((i) => i + 1)}
                className="relative max-h-[40vh] w-auto max-w-full -rotate-2 rounded-xl object-cover shadow-2xl ring-1 ring-white/10 transition-transform duration-500 ease-out group-hover:-rotate-1 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100"
              />
            </div>
          ) : (
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-silver/60">
              4K pages · no account needed to view
            </p>
          )}
        </aside>

        {/* ── Right form panel ───────────────────────────────────────── */}
        <main className="flex min-h-screen flex-1 items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            <div className="mb-10 flex justify-center lg:hidden">
              <WordMark className="text-night" />
            </div>

            <h1 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              {isSignup ? "Create your studio" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-dim">
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

            <Button
              type="button"
              variant="outline"
              className="mt-8 h-11 w-full rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              onClick={() =>
                toast.info(
                  "Google sign-in is being configured for this environment — use email for now."
                )
              }
            >
              <GoogleMark />
              Continue with Google
            </Button>

            <div className="my-7 flex items-center gap-3" aria-hidden="true">
              <Separator className="flex-1" />
              <span className="text-xs text-dim">
                or continue with email
              </span>
              <Separator className="flex-1" />
            </div>

            {serverError && (
              <Alert variant="destructive" className="mb-5">
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
                    className="pr-12"
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
                {isSignup ? "Sign in" : "Create an account"}
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
      </div>
    </MotionConfig>
  );
}
