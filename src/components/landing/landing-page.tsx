"use client";

import { useReducedMotion } from "framer-motion";
import { HeroParallaxIntro } from "@/components/landing/hero-parallax-intro";
import { LandingDescription } from "@/components/landing/landing-description";
import { ParallaxSection } from "@/components/landing/parallax-section";

export type ParallaxSectionConfig = {
  id: string;
  title: string;
  subtitle?: string;
  imageSrc: string;
  imageAlt: string;
  yStart: string;
  yEnd: string;
};

const parallaxSections: ParallaxSectionConfig[] = [
  {
    id: "vision",
    title: "Depth In Motion",
    subtitle: "A cinematic scroll experience inspired by tactile editorial layouts.",
    imageSrc: "/images/matthias-1.jpg",
    imageAlt: "Forest path with cinematic light",
    yStart: "-10vh",
    yEnd: "10vh",
  },
  {
    id: "pace",
    title: "Designed To Breathe",
    subtitle: "Large frames, quiet copy, and natural pacing between sections.",
    imageSrc: "/images/matthias-2.jpg",
    imageAlt: "Mountain ridge and open sky",
    yStart: "-12vh",
    yEnd: "12vh",
  },
  {
    id: "focus",
    title: "Intentional Contrast",
    subtitle: "Foreground typography anchored against drifting background imagery.",
    imageSrc: "/images/matthias-3.jpg",
    imageAlt: "Snowy landscape with distant horizon",
    yStart: "-10vh",
    yEnd: "10vh",
  },
];

export function LandingPage() {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <main className="landing-root relative -mt-16">
      <HeroParallaxIntro
        imageSrc="/images/matthias-1.jpg"
        imageAlt="Moody mountain scene"
        shouldReduceMotion={shouldReduceMotion}
      />

      <LandingDescription
        eyebrow="Parallax Study"
        title="Scroll choreography with restrained motion and clear hierarchy"
        body="This landing page layers fixed-image parallax with deliberate section pacing for a polished editorial feel."
      />

      {parallaxSections.map((section) => (
        <ParallaxSection
          key={section.id}
          title={section.title}
          subtitle={section.subtitle}
          imageSrc={section.imageSrc}
          imageAlt={section.imageAlt}
          yStart={section.yStart}
          yEnd={section.yEnd}
          shouldReduceMotion={shouldReduceMotion}
        />
      ))}

      <section className="min-h-[40vh] bg-gradient-to-b from-slate-950 to-black px-6 py-20 md:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">
            Photos by Matthias Leidinger
          </p>
        </div>
      </section>
    </main>
  );
}
