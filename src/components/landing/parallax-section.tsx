"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type ParallaxSectionProps = {
  title: string;
  subtitle?: string;
  imageSrc: string;
  imageAlt: string;
  yStart: string;
  yEnd: string;
  shouldReduceMotion: boolean;
};

export function ParallaxSection({
  title,
  subtitle,
  imageSrc,
  imageAlt,
  yStart,
  yEnd,
  shouldReduceMotion,
}: ParallaxSectionProps) {
  const container = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [yStart, yEnd]);

  return (
    <section
      ref={container}
      className="relative flex h-screen items-center justify-center overflow-hidden"
      style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
      aria-label={title}
    >
      <div className="relative z-20 mx-6 max-w-3xl rounded-2xl border border-white/20 bg-black/35 px-6 py-8 backdrop-blur-sm md:px-10 md:py-12">
        <h2 className="text-balance text-3xl font-semibold text-white md:text-5xl">{title}</h2>
        {subtitle ? <p className="mt-4 text-base text-slate-100 md:text-lg">{subtitle}</p> : null}
      </div>

      <div className="landing-fixed-frame fixed left-0 top-[-10vh] h-[120vh] w-full">
        {shouldReduceMotion ? (
          <div className="relative h-full w-full">
            <Image src={imageSrc} alt={imageAlt} fill sizes="100vw" className="object-cover" />
          </div>
        ) : (
          <motion.div style={{ y }} className="relative h-full w-full">
            <Image src={imageSrc} alt={imageAlt} fill sizes="100vw" className="object-cover" />
          </motion.div>
        )}
      </div>

      <div className="landing-section-overlay pointer-events-none absolute inset-0" />
    </section>
  );
}
