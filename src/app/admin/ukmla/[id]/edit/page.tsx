import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { ukmlaQuestions } from '@/db/schema';
import { UkmlaAdminForm } from '@/components/ukmla-admin-form';
import { requireAdmin } from '@/lib/admin';

export default async function EditUkmlaQuestionPage({ params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }

    await requireAdmin();

    const { id } = await params;
    const questionId = Number(id);
    if (Number.isNaN(questionId)) {
        notFound();
    }

    const question = await db.query.ukmlaQuestions.findFirst({
        where: eq(ukmlaQuestions.id, questionId),
        with: {
            options: true,
        },
    });

    if (!question) {
        notFound();
    }

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <UkmlaAdminForm question={question as never} />
        </div>
    );
}
