import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { and, asc, eq, gt } from 'drizzle-orm';
import { loadUkmlaQuestionForAttempt } from '@/actions/ukmla-student';
import { UkmlaPlayer } from '@/components/ukmla-player';
import { db } from '@/db';
import { ukmlaQuestions } from '@/db/schema';

export default async function UkmlaQuestionPage({ params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }

    const { id } = await params;
    const questionId = Number(id);
    if (Number.isNaN(questionId)) {
        notFound();
    }

    const result = await loadUkmlaQuestionForAttempt(questionId);
    if (!result.success || !result.data) {
        notFound();
    }

    const nextQuestion = await db.query.ukmlaQuestions.findFirst({
        where: and(eq(ukmlaQuestions.isPublished, true), gt(ukmlaQuestions.id, questionId)),
        orderBy: [asc(ukmlaQuestions.id)],
        columns: { id: true },
    });

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <UkmlaPlayer question={result.data} nextQuestionId={nextQuestion?.id || null} />
        </div>
    );
}
