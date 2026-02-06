export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">About</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">About NextMed</h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          NextMed is a medical education platform designed to help students develop safe, structured clinical
          reasoning through case simulation, UKMLA-focused practice, and targeted revision.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          The platform is built with clinician and educator input to keep learning practical, relevant, and aligned
          with modern assessment standards.
        </p>
      </div>
    </main>
  );
}
