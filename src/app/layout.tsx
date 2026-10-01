import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/* Source Serif 4 — a neutral, highly readable text serif. Pairs with
   Inter for an established, editorial-but-modern identity. */
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Light mode only — a single permanent color scheme (no dark theme).
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${sourceSerif.variable} font-sans antialiased bg-background text-foreground`}
      >
        {/* Light mode only — no ThemeProvider, no theme toggle, ever. */}
        {children}
        {/* Top-center toasts — bottom-center toasts overlapped dashboard
            cards and the editor's mobile tool rail. */}
        <Toaster position="top-center" closeButton richColors offset={18} />
      </body>
    </html>
  );
}
