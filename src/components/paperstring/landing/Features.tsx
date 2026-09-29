"use client";

import {
  Brush,
  Gem,
  Layers,
  ShieldCheck,
  Sticker,
  Type,
} from "lucide-react";
import { Reveal, SectionHeading } from "./shared";

const FEATURES = [
  {
    icon: Layers,
    title: "Layers made simple",
    copy: "Stack paint, text, photos and stickers — reorder, hide or blend with one tap.",
  },
  {
    icon: Type,
    title: "An advanced text tool",
    copy: "22 beautiful fonts, perfect sizing, rotation and color — every word lands exactly right.",
  },
  {
    icon: Brush,
    title: "One perfect brush",
    copy: "A clean pen with size and opacity control. No overwhelming menus — just flow.",
  },
  {
    icon: Sticker,
    title: "Stickers & templates",
    copy: "Hearts, stars, flowers and wreaths — drag them on, make it yours.",
  },
  {
    icon: Gem,
    title: "True 4K quality",
    copy: "Every page is rendered in stunning 4K. No settings, no compromises — beauty by default.",
  },
  {
    icon: ShieldCheck,
    title: "Private until shared",
    copy: "Your studio is yours. Only a share link you create lets anyone see the finished book.",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="ps-grain scroll-mt-24 bg-smoke py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Features"
            title="A tiny studio with serious craft"
            sub="Everything you need to make something heartfelt — and nothing you don't."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 0.1} className="h-full">
              <article className="h-full rounded-2xl border border-silver/30 bg-paper p-6 transition-all duration-200 hover:-translate-y-1 hover:border-silver/50 hover:shadow-[0_18px_40px_-18px_rgba(19,19,19,0.15)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-silver/40 bg-smoke/60 text-night">
                  <feature.icon
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
                <h3 className="mt-5 ps-serif text-lg text-night">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-dim">
                  {feature.copy}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
