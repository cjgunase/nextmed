import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUkmlaQuestions } from '@/actions/ukmla-student';
import { UkmlaFilterControls } from '@/components/ukmla-filter-controls';
import { UkmlaQuestionCard } from '@/components/ukmla-question-card';
import { Button } from '@/components/ui/button';
import { PaginationControls } from '@/components/pagination-controls';
import { difficultyLevels, ukmlaCategories } from '@/db/schema';
import { isAdmin } from '@/lib/auth-helpers';

export default async function UkmlaPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }

    const searchParams = await props.searchParams;
    const userIsAdmin = await isAdmin();
    const page = Number(searchParams.page) || 1;
    const pageSize = 24;
    const category = typeof searchParams.category === 'string' ? searchParams.category : undefined;
    const difficulty = typeof searchParams.difficulty === 'string' ? searchParams.difficulty : undefined;
    const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
    const status = searchParams.status === 'due' ? 'due' : 'all';

    const result = await getUkmlaQuestions({
        page,
        pageSize,
        category: category as never,
        difficulty: difficulty as never,
        search,
        status,
    });

    if (!result.success) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold">UKMLA Questions</h1>
                <p className="mt-2 text-destructive">{result.message || 'Failed to load UKMLA questions'}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">UKMLA MCQs</h1>
                    <p className="text-muted-foreground">Traditional single-best-answer UKMLA practice bank.</p>
                </div>
                <div className="flex gap-2">
                    {userIsAdmin && (
                        <Link href="/admin/ukmla">
                            <Button>Manage Questions</Button>
                        </Link>
                    )}
                    <Link href="/ukmla/review">
                        <Button variant="outline">Review Queue</Button>
                    </Link>
                    <Link href="/leaderboard?mode=ukmla">
                        <Button variant="outline">UKMLA Leaderboard</Button>
                    </Link>
                </div>
            </div>

            <UkmlaFilterControls
                categories={result.categories || ukmlaCategories}
                difficulties={result.difficulties || difficultyLevels}
            />

            {result.data.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                    No questions found for your current filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {result.data.map((question) => (
                        <UkmlaQuestionCard
                            key={question.id}
                            id={question.id}
                            stem={question.stem}
                            category={question.category}
                            difficultyLevel={question.difficultyLevel}
                            isDue={question.isDue}
                            nextReviewDate={question.nextReviewDate}
                        />
                    ))}
                </div>
            )}

            <PaginationControls
                currentPage={result.page || 1}
                totalPages={result.totalPages || 0}
                totalItems={result.total || 0}
                itemsPerPage={result.pageSize || pageSize}
            />
        </div>
    );
}
