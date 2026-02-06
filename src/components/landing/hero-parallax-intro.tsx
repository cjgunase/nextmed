"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type HeroParallaxIntroProps = {
  imageSrc: string;
  imageAlt: string;
  shouldReduceMotion: boolean;
};

export function HeroParallaxIntro({ imageSrc, imageAlt, shouldReduceMotion }: HeroParallaxIntroProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0vh", "150vh"]);

  return (
    <section ref={container} className="relative h-screen overflow-hidden">
      {shouldReduceMotion ? (
        <div className="relative h-full w-full">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <motion.div style={{ y }} className="relative h-full w-full">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      )}

      <div className="landing-hero-overlay pointer-events-none absolute inset-0" />
      <div className="absolute inset-0 flex items-end px-6 pb-16 md:px-10 md:pb-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-300">NextMed Studio</p>
          <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
            A layered scroll story with cinematic background motion
          </h1>
        </div>
      </div>
    </section>
  );
}
