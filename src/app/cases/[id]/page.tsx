import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Single Case View - Server Component
 * Displays a specific case with all stages and options
 * Only accessible by the case owner
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

    // 3. Fetch case with ownership verification
    const medicalCase = await db.query.cases.findFirst({
        where: and(
            eq(cases.id, caseId),
            eq(cases.userId, userId) // CRITICAL: User can only view their own cases
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

    // 4. Return 404 if case not found or user doesn't own it
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
                    <Link href={`/cases/${caseId}/edit`}>
                        <Button size="sm">Edit Case</Button>
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

            {/* Stages */}
            <div className="space-y-8">
                <h2 className="text-2xl font-bold">Case Stages</h2>

                {medicalCase.stages.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-lg">
                        <p className="text-muted-foreground">
                            No stages added yet. Edit the case to add stages.
                        </p>
                    </div>
                ) : (
                    medicalCase.stages.map((stage, index) => (
                        <div
                            key={stage.id}
                            className="border rounded-lg p-6 bg-slate-900/20"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-sm font-semibold px-3 py-1 bg-primary/20 text-primary rounded">
                                    Stage {stage.stageOrder}
                                </span>
                            </div>

                            <p className="text-lg mb-4 whitespace-pre-wrap">{stage.narrative}</p>

                            {stage.clinicalData && (
                                <div className="mb-4 p-4 bg-background/50 rounded">
                                    <h4 className="font-semibold mb-2">Clinical Data</h4>
                                    <pre className="text-sm">
                                        {JSON.stringify(stage.clinicalData as Record<string, unknown>, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {stage.options.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-3">Decision Options</h4>
                                    <div className="space-y-2">
                                        {stage.options.map((option) => (
                                            <div
                                                key={option.id}
                                                className={`p-4 rounded border ${option.isCorrect
                                                    ? 'border-green-500/30 bg-green-500/5'
                                                    : 'border-slate-700'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <p className="flex-1">{option.text}</p>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        {option.isCorrect && (
                                                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded">
                                                                Correct
                                                            </span>
                                                        )}
                                                        <span className="text-xs px-2 py-1 bg-slate-500/20 rounded">
                                                            {option.scoreWeight > 0 ? '+' : ''}
                                                            {option.scoreWeight}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {option.feedback}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
