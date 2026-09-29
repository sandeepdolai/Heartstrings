import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/paperstring/AppShell";
import { db } from "@/lib/db";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Base (non-viewer) metadata — mirrors layout.tsx so the landing route
 * renders the same OG card it always did. layout.tsx stays untouched and
 * still acts as the fallback for anything this page does not define.
 */
const BASE_METADATA: Metadata = {
  title: "PaperString — Make something beautiful for someone you love",
  description:
    "PaperString is a graphic creation studio for everyday people. Create heartfelt multi-page projects — love notes, friendship books, thank-you pages — and share them as a flip-book that opens straight to the heart.",
  keywords: [
    "PaperString",
    "graphic creation",
    "love notes",
    "flipbook",
    "friendship book",
    "shareable art",
  ],
  authors: [{ name: "PaperString" }],
  openGraph: {
    title: "PaperString",
    description:
      "Make something beautiful for someone you love — and share it like a flip-book that opens straight to the heart.",
    siteName: "PaperString",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

const VIEWER_DESCRIPTION =
  "Made with love in PaperString — flip through the pages.";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolves the published title for a share token. Only the title is
 * selected (publishedData presence is asserted via the where clause) so
 * metadata rendering never transfers the multi-megabyte page payload.
 * Returns null for unknown, unpublished or revoked links.
 */
async function lookupSharedBookTitle(token: string): Promise<string | null> {
  try {
    const project = await db.project.findFirst({
      where: { shareToken: token, publishedData: { not: null } },
      select: { title: true },
    });
    const title = project?.title?.trim();
    return title ? title : null;
  } catch {
    // A database hiccup must never break page rendering — fall back to
    // the base metadata below.
    return null;
  }
}

/**
 * Social/OG preview cards for shared books (Task 7-a): pasting
 * /?view=viewer&s={token} into WhatsApp/iMessage/Slack/Twitter should
 * unfurl with the book title and its first page as the image. `demo` is
 * the client-side showcase book (no DB row), so it keeps base metadata.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const view = firstParam(params.view);
  const token = firstParam(params.s);

  if (view === "viewer" && token && token !== "demo") {
    const bookTitle = await lookupSharedBookTitle(token);

    if (bookTitle) {
      const coverImage = `/api/share/${token}/cover`;
      return {
        title: `${bookTitle} — PaperString`,
        description: VIEWER_DESCRIPTION,
        openGraph: {
          title: `${bookTitle} — a book for you`,
          description: VIEWER_DESCRIPTION,
          siteName: "PaperString",
          type: "website",
          images: [
            {
              url: coverImage,
              width: 2160,
              height: 3840,
              alt: `“${bookTitle}” — cover page of the flip-book`,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: `${bookTitle} — a book for you`,
          description: VIEWER_DESCRIPTION,
          images: [
            {
              url: coverImage,
              alt: `“${bookTitle}” — cover page of the flip-book`,
            },
          ],
        },
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    return {
      title: "This book is no longer available — PaperString",
      description: "The link may have been revoked, or the book was never shared.",
      openGraph: {
        title: "This book is no longer available",
        description: "The link may have been revoked, or the book was never shared.",
        siteName: "PaperString",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: "This book is no longer available",
        description: "The link may have been revoked, or the book was never shared.",
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return BASE_METADATA;
}

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
