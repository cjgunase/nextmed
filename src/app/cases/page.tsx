import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, desc, or, and, like, sql, count } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { isAdmin } from '@/lib/auth-helpers';
import { CasesFilterControls } from '@/components/cases-filter-controls';
import { PaginationControls } from '@/components/pagination-controls';

const ITEMS_PER_PAGE = 24;

/**
 * Cases Page - Server Component with Pagination
 * Efficiently handles large datasets (5000+ cases) using server-side pagination and filtering
 */
export default async function CasesPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    // 1. Authenticate user (Server Component pattern)
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    // 2. Parse search params for pagination and filtering (await for Next.js 15)
    const searchParams = await props.searchParams;
    const page = Number(searchParams.page) || 1;
    const domain = typeof searchParams.domain === 'string' ? searchParams.domain : undefined;
    const difficulty = typeof searchParams.difficulty === 'string' ? searchParams.difficulty : undefined;
    const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;

    // 3. Build filter conditions
    const filters = [];

    // Base filter: published cases OR user's own cases
    filters.push(
        or(
            eq(cases.isPublished, true),
            eq(cases.userId, userId)
        )!
    );

    // Domain filter
    if (domain) {
        filters.push(eq(cases.clinicalDomain, domain));
    }

    // Difficulty filter
    if (difficulty) {
        filters.push(eq(cases.difficultyLevel, difficulty as 'Foundation' | 'Core' | 'Advanced'));
    }

    // Search filter (title, description, or domain)
    if (search) {
        filters.push(
            or(
                like(cases.title, `%${search}%`),
                like(cases.description, `%${search}%`),
                like(cases.clinicalDomain, `%${search}%`)
            )!
        );
    }

    const whereClause = filters.length > 1 ? and(...filters) : filters[0];

    // 4. Get total count for pagination
    const [{ total }] = await db
        .select({ total: count() })
        .from(cases)
        .where(whereClause);

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // 5. Fetch paginated cases
    const userCases = await db.query.cases.findMany({
        where: whereClause,
        orderBy: [desc(cases.createdAt)],
        limit: ITEMS_PER_PAGE,
        offset: offset,
        with: {
            stages: {
                orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
            },
        },
    });

    // 6. Get unique domains and difficulties for filters (from all cases, not just current page)
    const [domainsResult, difficultiesResult] = await Promise.all([
        db.selectDistinct({ domain: cases.clinicalDomain })
            .from(cases)
            .where(or(eq(cases.isPublished, true), eq(cases.userId, userId))!),
        db.selectDistinct({ difficulty: cases.difficultyLevel })
            .from(cases)
            .where(or(eq(cases.isPublished, true), eq(cases.userId, userId))!),
    ]);

    const domains = domainsResult.map((r) => r.domain).sort();
    const difficulties = difficultiesResult
        .map((r) => r.difficulty)
        .sort((a, b) => {
            const order = ['Foundation', 'Core', 'Advanced'];
            return order.indexOf(a) - order.indexOf(b);
        });

    // 7. Check if user is admin
    const userIsAdmin = await isAdmin();

    // 8. Helper function for difficulty colors
    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Foundation':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'Core':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'Advanced':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Clinical Cases</h1>
                        <p className="text-muted-foreground mt-2">
                            Practice with real-world medical scenarios organized by specialty and difficulty
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

                {/* Filters */}
                <CasesFilterControls domains={domains} difficulties={difficulties} />

                {/* Cases Display */}
                <div className="mt-6">
                    {total === 0 ? (
                        <div className="text-center py-12 border border-dashed rounded-lg">
                            <h3 className="text-xl font-semibold mb-2">No cases found</h3>
                            <p className="text-muted-foreground mb-4">
                                {search || domain || difficulty
                                    ? 'Try adjusting your filters or search query'
                                    : userIsAdmin
                                        ? 'Create your first medical case to get started'
                                        : 'No published cases available yet. Check back soon!'}
                            </p>
                            {userIsAdmin && !search && !domain && !difficulty && (
                                <Link href="/cases/new">
                                    <Button>Create Your First Case</Button>
                                </Link>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Cases Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {userCases.map((caseItem) => (
                                    <Link
                                        key={caseItem.id}
                                        href={`/cases/${caseItem.id}`}
                                        className="block h-full group"
                                    >
                                        <div className="border rounded-xl p-5 hover:border-primary transition-all duration-200 h-full flex flex-col hover:shadow-lg hover:scale-[1.02] bg-card">
                                            <div className="flex items-start justify-between mb-3 gap-2">
                                                <h4 className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors flex-1">
                                                    {caseItem.title}
                                                </h4>
                                                <div className="flex flex-col gap-1 shrink-0">
                                                    {caseItem.isPublished ? (
                                                        <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded-md font-medium">
                                                            Published
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400 rounded-md font-medium">
                                                            Draft
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Difficulty Badge */}
                                            <div className="mb-3">
                                                <span
                                                    className={`inline-block px-3 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(
                                                        caseItem.difficultyLevel
                                                    )}`}
                                                >
                                                    {caseItem.difficultyLevel}
                                                </span>
                                            </div>

                                            {/* Domain Badge */}
                                            <div className="mb-3">
                                                <Badge variant="outline" className="text-xs">
                                                    {caseItem.clinicalDomain}
                                                </Badge>
                                            </div>

                                            <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow leading-relaxed">
                                                {caseItem.description}
                                            </p>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-3 border-t">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">
                                                    {caseItem.source === 'ai'
                                                        ? '🤖 AI Generated'
                                                        : '👤 Human Created'}
                                                </span>
                                                <span className="font-semibold text-primary">
                                                    {caseItem.stages.length}{' '}
                                                    {caseItem.stages.length !== 1 ? 'stages' : 'stage'}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            <PaginationControls
                                currentPage={page}
                                totalPages={totalPages}
                                totalItems={total}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
