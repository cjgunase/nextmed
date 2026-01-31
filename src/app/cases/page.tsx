import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, desc, or } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { isAdmin } from '@/lib/auth-helpers';

/**
 * Cases Page - Server Component
 * Fetches and displays all published cases (from any user) and user's own unpublished cases
 */
export default async function CasesPage() {
    // 1. Authenticate user (Server Component pattern)
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    // 2. Fetch cases: ALL published cases (including admin-generated) OR user's own cases
    const userCases = await db.query.cases.findMany({
        where: or(
            eq(cases.isPublished, true), // Show all published cases (admin + student)
            eq(cases.userId, userId) // Show user's own unpublished drafts
        ),
        orderBy: [desc(cases.createdAt)],
        with: {
            stages: {
                orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
            },
        },
    });

    // 3. Check if user is admin
    const userIsAdmin = await isAdmin();

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Clinical Cases</h1>
                    <p className="text-muted-foreground mt-2">
                        Practice with real-world medical scenarios
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/leaderboard">
                        <Button variant="outline">🏆 Leaderboard</Button>
                    </Link>
                    {userIsAdmin && (
                        <Link href="/cases/new">
                            <Button>Create New Case</Button>
                        </Link>
                    )}
                </div>
            </div>

            {userCases.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                    <h3 className="text-xl font-semibold mb-2">No cases yet</h3>
                    <p className="text-muted-foreground mb-4">
                        {userIsAdmin
                            ? 'Create your first medical case to get started'
                            : 'No published cases available yet. Check back soon!'}
                    </p>
                    {userIsAdmin && (
                        <Link href="/cases/new">
                            <Button>Create Your First Case</Button>
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCases.map((caseItem) => (
                        <Link
                            key={caseItem.id}
                            href={`/cases/${caseItem.id}`}
                            className="block h-full group"
                        >
                            <div className="border rounded-lg p-6 hover:border-primary transition-all h-full flex flex-col hover:shadow-md bg-card">
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                                        {caseItem.title}
                                    </h3>
                                    {caseItem.isPublished ? (
                                        <span className="px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded shrink-0 ml-2">
                                            Published
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs bg-slate-500/10 text-slate-500 rounded shrink-0 ml-2">
                                            Draft
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">
                                    {caseItem.description}
                                </p>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 w-full">
                                    <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                                        {caseItem.clinicalDomain}
                                    </span>
                                    <span className="px-2 py-1 bg-slate-500/10 rounded">
                                        {caseItem.difficultyLevel}
                                    </span>
                                    <span className="ml-auto font-medium">
                                        {caseItem.stages.length} stage{caseItem.stages.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
