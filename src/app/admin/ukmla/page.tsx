import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminUkmlaQuestions } from '@/actions/ukmla-admin';
import { UkmlaAdminTable } from '@/components/ukmla-admin-table';
import { Button } from '@/components/ui/button';
import { ukmlaCategories, difficultyLevels } from '@/db/schema';
import { isAdmin } from '@/lib/admin';

export default async function AdminUkmlaPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }
    if (!(await isAdmin())) {
        redirect('/cases');
    }

    const searchParams = await props.searchParams;
    const page = Number(searchParams.page) || 1;
    const category = typeof searchParams.category === 'string' ? searchParams.category : undefined;
    const difficulty = typeof searchParams.difficulty === 'string' ? searchParams.difficulty : undefined;
    const verificationStatus =
        typeof searchParams.verificationStatus === 'string'
            ? searchParams.verificationStatus
            : undefined;
    const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;

    const data = await getAdminUkmlaQuestions({
        page,
        pageSize: 50,
        category: category as never,
        difficulty: difficulty as never,
        verificationStatus: verificationStatus as never,
        search,
    });

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Admin UKMLA Question Bank</h1>
                    <p className="text-muted-foreground">Create, review, generate, and publish UKMLA questions.</p>
                </div>
                <Link href="/admin">
                    <Button variant="outline">Back to Admin</Button>
                </Link>
            </div>

            <form className="grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-5" method="GET">
                <select
                    name="category"
                    defaultValue={category || ''}
                    className="h-10 rounded-md border bg-background px-3"
                >
                    <option value="">All categories</option>
                    {ukmlaCategories.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>

                <select
                    name="difficulty"
                    defaultValue={difficulty || ''}
                    className="h-10 rounded-md border bg-background px-3"
                >
                    <option value="">All difficulties</option>
                    {difficultyLevels.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>

                <select
                    name="verificationStatus"
                    defaultValue={verificationStatus || ''}
                    className="h-10 rounded-md border bg-background px-3"
                >
                    <option value="">All verification states</option>
                    <option value="draft">Draft</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                </select>

                <input
                    name="search"
                    defaultValue={search || ''}
                    placeholder="Search stem"
                    className="h-10 rounded-md border bg-background px-3"
                />

                <Button type="submit">Apply Filters</Button>
            </form>

            <UkmlaAdminTable questions={data.questions as never} />
        </div>
    );
}
