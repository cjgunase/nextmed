export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Terms of Use</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Terms of Use</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          By using NextMed, you agree to use the platform for lawful educational purposes only. Users are responsible
          for maintaining account security and for all activity performed under their account.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          NextMed is provided as a learning platform and does not provide medical advice or clinical decision support
          for patient care.
        </p>
      </div>
    </main>
  );
}
