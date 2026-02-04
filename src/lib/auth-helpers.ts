import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAdmin as isAllowlistAdmin } from '@/lib/admin';

/**
 * Get the current user's role from the database
 */
export async function getUserRole(userId?: string): Promise<'student' | 'admin' | null> {
    const { userId: authUserId } = await auth();
    const lookupUserId = userId || authUserId;

    if (!lookupUserId) {
        return null;
    }

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, lookupUserId),
            columns: {
                role: true,
            },
        });

        return user?.role as 'student' | 'admin' || null;
    } catch (error) {
        console.error('Error fetching user role:', error);
        return null;
    }
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    return isAllowlistAdmin();
}

/**
 * Check if the current user is a student
 */
export async function isStudent(): Promise<boolean> {
    const role = await getUserRole();
    return role === 'student';
}
