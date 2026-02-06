import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const coreFeatures = [
  {
    title: "Case-Based Clinical Simulations",
    description:
      "Practice structured diagnostic reasoning through realistic patient journeys with staged decisions and feedback.",
  },
  {
    title: "UKMLA-Focused Question Practice",
    description:
      "Train with exam-style questions aligned to high-yield domains so revision stays relevant to assessment goals.",
  },
  {
    title: "Targeted Revision Support",
    description:
      "Identify weak areas quickly and focus on the topics that will improve your confidence and exam performance.",
  },
];

const studentBenefits = [
  "Build a repeatable approach to history, differential diagnosis, investigation, and management.",
  "Strengthen exam technique with repeated timed practice and clear progression tracking.",
  "Turn mistakes into learning points with immediate, structured feedback after each attempt.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-gradient-to-b from-sky-100/70 via-cyan-50/40 to-transparent dark:from-sky-950/45 dark:via-cyan-950/20"
        aria-hidden
      />
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-20 md:px-10 md:pt-28">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="border border-border/70 bg-card/80 text-foreground">
            NextMed for Medical Students
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight md:text-6xl">
            A clinical learning platform built to improve reasoning, revision, and exam readiness
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            NextMed combines case simulation, UKMLA-style practice, and personalized revision so you can train like
            real clinical work while staying aligned with exam outcomes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {coreFeatures.map((feature) => (
            <Card key={feature.title} className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-14">
        <Separator />
        <div className="mt-10 grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How It Helps</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold md:text-4xl">
              Designed for everyday study and long-term clinical confidence
            </h2>
          </div>
          <div className="space-y-4">
            {studentBenefits.map((benefit) => (
              <div key={benefit} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
