const faqs = [
  {
    question: "Who is NextMed for?",
    answer:
      "NextMed is built for medical students who want to strengthen clinical reasoning, prepare for exams, and track performance over time.",
  },
  {
    question: "Is NextMed aligned to UKMLA preparation?",
    answer:
      "Yes. The platform includes UKMLA-focused practice and revision workflows designed around high-yield clinical content.",
  },
  {
    question: "Does NextMed replace clinical supervision?",
    answer:
      "No. NextMed is an educational tool that supports study and deliberate practice; it does not replace clinical teaching or supervision.",
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">FAQ</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <div className="mt-8 space-y-6">
          {faqs.map((item) => (
            <section key={item.question} className="rounded-lg border border-border p-5">
              <h2 className="text-lg font-semibold">{item.question}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
