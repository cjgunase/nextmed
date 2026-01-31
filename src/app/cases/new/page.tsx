import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth-helpers';

/**
 * Cases New Page - Admin Only Route
 * Redirects students to the cases list
 */
export default async function CasesNewPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin();

    if (!userIsAdmin) {
        // Redirect students to cases list
        redirect('/cases');
    }

    // For now, redirect admins to the admin dashboard where they can create cases
    redirect('/admin');
}
