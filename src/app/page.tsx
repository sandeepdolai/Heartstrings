import { Suspense } from "react";
import { AppShell } from "@/components/paperstring/AppShell";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-smoke">
          <p className="text-xs uppercase tracking-[0.3em] text-dim">
            PaperString
          </p>
        </div>
      }
    >
      <AppShell />
    </Suspense>
  );
}
