import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Single Case View - Server Component
 * Displays a specific case with all stages and options
 * Accessible by: case owner OR anyone if case is published
 */
export default async function CasePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = await params;

    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }

    // 2. Parse and validate case ID
    const caseId = parseInt(resolvedParams.id);
    if (isNaN(caseId)) {
        notFound();
    }

    // 3. Fetch case - allow if published OR user owns it
    const medicalCase = await db.query.cases.findFirst({
        where: and(
            eq(cases.id, caseId),
            or(
                eq(cases.isPublished, true), // Anyone can view published cases
                eq(cases.userId, userId) // Owner can view their drafts
            )
        ),
        with: {
            stages: {
                orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
                with: {
                    options: true,
                },
            },
        },
    });

    // 4. Return 404 if case not found or user doesn't have access
    if (!medicalCase) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <Link href="/cases">
                        <Button variant="outline" size="sm">
                            ← Back to Cases
                        </Button>
                    </Link>


                </div>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">{medicalCase.title}</h1>
                        <p className="text-muted-foreground">{medicalCase.description}</p>
                    </div>
                    {medicalCase.isPublished ? (
                        <span className="px-3 py-1 text-sm bg-green-500/10 text-green-500 rounded">
                            Published
                        </span>
                    ) : (
                        <span className="px-3 py-1 text-sm bg-slate-500/10 text-slate-500 rounded">
                            Draft
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 mt-4">
                    <span className="px-3 py-1 text-sm bg-primary/10 text-primary rounded">
                        {medicalCase.clinicalDomain}
                    </span>
                    <span className="px-3 py-1 text-sm bg-slate-500/10 rounded">
                        {medicalCase.difficultyLevel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        Created {new Date(medicalCase.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </div>

            {/* Case Preview (No Spoilers) */}
            <div className="mt-12 text-center p-12 bg-slate-900/10 rounded-xl border border-dashed">
                <div className="max-w-md mx-auto">
                    <h3 className="text-xl font-semibold mb-3">Ready to Practice?</h3>
                    <p className="text-muted-foreground mb-6">
                        Start the simulation to test your clinical reasoning skills.
                        You'll interact with the patient and make decisions in real-time.
                    </p>
                    <Link href={`/cases/${caseId}/simulate`}>
                        <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">
                            ▶ Start Simulation
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
