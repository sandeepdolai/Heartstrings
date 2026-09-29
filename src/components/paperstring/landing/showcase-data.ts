/**
 * Showcase artwork — six portrait pages "made with PaperString" (720×1440).
 * The hero flipbook uses the first four; the showcase strip uses all six.
 */

export interface ShowcasePage {
  /** public path of the rendered page image */
  src: string;
  /** short caption shown under the strip item */
  label: string;
  /** descriptive alt text */
  alt: string;
}

export const SHOWCASE_PAGES: ShowcasePage[] = [
  {
    src: "/showcase/page-1.png",
    label: "A love letter",
    alt: "Sample PaperString page: a love letter with watercolor roses",
  },
  {
    src: "/showcase/page-2.png",
    label: "A friendship book",
    alt: "Sample PaperString page: a friendship book with doodles and taped photos",
  },
  {
    src: "/showcase/page-3.png",
    label: "Birthday wishes",
    alt: "Sample PaperString page: birthday wishes with candles and confetti",
  },
  {
    src: "/showcase/page-4.png",
    label: "A thank-you note",
    alt: "Sample PaperString page: a thank-you note with pressed flowers",
  },
  {
    src: "/showcase/page-5.png",
    label: "A starlit poem",
    alt: "Sample PaperString page: a starlit night poem in white ink",
  },
  {
    src: "/showcase/page-6.png",
    label: "Our adventure",
    alt: "Sample PaperString page: travel memories with tickets and a hand-drawn map",
  },
];
