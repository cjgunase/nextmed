import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getReviewQueue, getDueReviewCount } from '@/actions/student';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Brain, Calendar, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // Assuming badge exists, if not I'll just use tailwind classes or remove it

export default async function ReviewPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    const { data: reviewCards, success } = await getReviewQueue(50);
    const { count: dueCount } = await getDueReviewCount();

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Brain className="h-8 w-8 text-indigo-600" />
                        Spaced Repetition Review
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Review cases at optimal intervals to maximize long-term retention
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium text-indigo-900">
                        {dueCount} cases duo for review
                    </span>
                </div>
            </div>

            {reviewCards && reviewCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reviewCards.map((card) => {
                        // Calculate days overdue or due in (if future items shown)
                        const nextReview = new Date(card.nextReviewDate);
                        const now = new Date();
                        const diffDays = Math.ceil((now.getTime() - nextReview.getTime()) / (1000 * 3600 * 24));
                        const isOverdue = diffDays > 0;

                        return (
                            <Card key={card.id} className="flex flex-col h-full hover:shadow-md transition-all border-indigo-100/50">
                                <CardHeader>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            {card.case.clinicalDomain}
                                        </Badge>
                                        <Badge variant="outline" className={`${card.case.difficultyLevel === 'Foundation' ? 'bg-green-50 text-green-700 border-green-200' :
                                                card.case.difficultyLevel === 'Core' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            {card.case.difficultyLevel}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl line-clamp-2">{card.case.title}</CardTitle>
                                    <CardDescription className="line-clamp-2 mt-2">
                                        {card.case.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow pt-0">
                                    <div className="space-y-3 mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                                        <div className="flex justify-between">
                                            <span>Current Interval:</span>
                                            <span className="font-medium text-gray-900">{card.interval} days</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Success Streaks:</span>
                                            <span className="font-medium text-gray-900">{card.repetitions}x</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Next Review:</span>
                                            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                                                {isOverdue ? `${Math.abs(diffDays)} days overdue` : 'Today'}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-4 border-t bg-gray-50/50">
                                    <Link href={`/cases/${card.case.id}`} className="w-full">
                                        <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
                                            Start Review
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card className="bg-gray-50 border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                        <div className="bg-white p-4 rounded-full shadow-sm">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">All Caught Up!</h3>
                        <p className="text-muted-foreground max-w-md">
                            You have no pending reviews. Great job staying on top of your spaced repetition schedule.
                        </p>
                        <Link href="/cases">
                            <Button variant="outline" className="mt-4">
                                Browse New Cases
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
