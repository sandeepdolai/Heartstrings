import { cn } from "@/lib/utils";

/**
 * PaperString brand mark — a heart drawn with a single string, two loose ends
 * trailing away. Used across landing, auth, dashboard, editor and viewer.
 */

export function LogoMark({
  className,
  strokeWidth = 3.4,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 72 64"
      fill="none"
      aria-hidden="true"
      className={cn("h-7 w-8", className)}
    >
      {/* the string heart */}
      <path
        d="M17 33c0-11.5 10-17.5 17-11.5 7-6 17 0 17 11.5 0 13.5-14.5 21-17 23-2.5-2-17-9.5-17-23Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* loose string ends */}
      <path
        d="M17 33c-4.5-3-7-7-5.5-13"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.72}
        strokeLinecap="round"
      />
      <path
        d="M51 33c4.5-3 7-7 5.5-13"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.72}
        strokeLinecap="round"
      />
      {/* the knot */}
      <circle
        cx="34"
        cy="45.5"
        r="2.2"
        fill="currentColor"
      />
    </svg>
  );
}

export function WordMark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-[1.05rem] font-semibold tracking-tight">
        PaperString
      </span>
    </span>
  );
}
