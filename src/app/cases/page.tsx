import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Cases Page - Server Component
 * Fetches and displays all cases for the authenticated user
 */
export default async function CasesPage() {
    // 1. Authenticate user (Server Component pattern)
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    // 2. Fetch user's cases directly in Server Component (NOT via API route)
    const userCases = await db.query.cases.findMany({
        where: eq(cases.userId, userId), // CRITICAL: Filter by authenticated user
        orderBy: [desc(cases.createdAt)],
        with: {
            stages: {
                orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
            },
        },
    });

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">My Cases</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your medical case scenarios
                    </p>
                </div>
                <Link href="/cases/new">
                    <Button>Create New Case</Button>
                </Link>
            </div>

            {userCases.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                    <h3 className="text-xl font-semibold mb-2">No cases yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Create your first medical case to get started
                    </p>
                    <Link href="/cases/new">
                        <Button>Create Your First Case</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCases.map((caseItem) => (
                        <div
                            key={caseItem.id}
                            className="border rounded-lg p-6 hover:border-primary transition-colors"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="text-lg font-semibold line-clamp-2">
                                    {caseItem.title}
                                </h3>
                                {caseItem.isPublished ? (
                                    <span className="px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded">
                                        Published
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 text-xs bg-slate-500/10 text-slate-500 rounded">
                                        Draft
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                                {caseItem.description}
                            </p>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                                    {caseItem.clinicalDomain}
                                </span>
                                <span className="px-2 py-1 bg-slate-500/10 rounded">
                                    {caseItem.difficultyLevel}
                                </span>
                            </div>

                            <div className="text-xs text-muted-foreground mb-4">
                                {caseItem.stages.length} stage
                                {caseItem.stages.length !== 1 ? 's' : ''}
                            </div>

                            <div className="flex gap-2">
                                <Link href={`/cases/${caseItem.id}`} className="flex-1">
                                    <Button variant="outline" className="w-full" size="sm">
                                        View
                                    </Button>
                                </Link>
                                <Link href={`/cases/${caseItem.id}/edit`} className="flex-1">
                                    <Button variant="default" className="w-full" size="sm">
                                        Edit
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
