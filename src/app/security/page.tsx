export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data Security</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Data Security</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          We apply layered security controls including authenticated access, secure transport, role-based permissions,
          and infrastructure-level protections. Security practices are continuously reviewed to reduce risk and protect
          user data.
        </p>
      </div>
    </main>
  );
}
