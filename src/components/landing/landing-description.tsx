type LandingDescriptionProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function LandingDescription({ eyebrow, title, body }: LandingDescriptionProps) {
  return (
    <section className="landing-description px-6 py-20 md:px-10 md:py-28" aria-label="Introduction">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-6 max-w-4xl text-balance text-3xl font-semibold text-white md:text-5xl">{title}</h2>
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">{body}</p>
      </div>
    </section>
  );
}
