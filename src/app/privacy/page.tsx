export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Privacy Policy</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          We only collect the information needed to provide and improve NextMed, including account details, learning
          activity, and performance metrics. We do not sell personal data. Access to user data is restricted and
          controlled through authenticated access.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          If you have a privacy request, contact us at support@nextmed.ai.
        </p>
      </div>
    </main>
  );
}
