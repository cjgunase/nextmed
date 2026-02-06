import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUkmlaDueReviewCount, getUkmlaReviewQueue } from '@/actions/ukmla-student';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function UkmlaReviewPage() {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }

    const [queueResult, countResult] = await Promise.all([
        getUkmlaReviewQueue(50),
        getUkmlaDueReviewCount(),
    ]);

    const queue = queueResult.success ? queueResult.data : [];
    const dueCount = countResult.count || 0;

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">UKMLA Review Queue</h1>
                <p className="text-muted-foreground">{dueCount} question(s) due for spaced repetition.</p>
            </div>

            {queue.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">No due questions right now.</p>
                        <Link href="/ukmla">
                            <Button variant="outline" className="mt-4">Browse UKMLA Questions</Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {queue.map((card) => (
                        <Card key={card.id}>
                            <CardHeader>
                                <CardTitle className="line-clamp-2 text-base">{card.question.stem}</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    {card.question.category} • {card.question.difficultyLevel}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Due since {new Date(card.nextReviewDate).toLocaleDateString()}
                                </p>
                                <Link href={`/ukmla/${card.question.id}`}>
                                    <Button className="mt-3 w-full">Start Review</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
