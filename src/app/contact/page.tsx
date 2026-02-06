export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Contact Us</h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Questions, feedback, or partnership enquiries are welcome. Please email{" "}
          <a href="mailto:support@nextmed.ai" className="font-medium text-primary hover:underline">
            support@nextmed.ai
          </a>{" "}
          and our team will respond as soon as possible.
        </p>
      </div>
    </main>
  );
}
