import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UkmlaAdminForm } from '@/components/ukmla-admin-form';
import { isAdmin } from '@/lib/admin';

export default async function NewUkmlaQuestionPage() {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }
    if (!(await isAdmin())) {
        redirect('/cases');
    }

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <UkmlaAdminForm />
        </div>
    );
}
