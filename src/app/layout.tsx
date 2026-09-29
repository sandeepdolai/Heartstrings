import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3f3" },
    { media: "(prefers-color-scheme: dark)", color: "#131313" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-center" closeButton richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
