import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Get admin emails from environment variable
 * Returns array of authorized admin email addresses
 */
function getAdminEmails(): string[] {
    const adminEmailsString = process.env.ADMIN_EMAILS || '';
    return adminEmailsString
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0);
}

/**
 * Check if the current authenticated user is an admin
 * Returns true if user's email is in the ADMIN_EMAILS allowlist
 */
export async function isAdmin(): Promise<boolean> {
    try {
        const user = await currentUser();
        if (!user) {
            return false;
        }

        const adminEmails = getAdminEmails();
        const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();

        if (!userEmail) return false;

        return adminEmails.includes(userEmail);
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Require admin authentication - throws error if not admin
 * Use this in server actions to protect admin-only operations
 */
export async function requireAdmin(): Promise<void> {
    const { userId } = await auth();

    if (!userId) {
        throw new Error('Unauthorized: Not authenticated');
    }

    const adminStatus = await isAdmin();

    if (!adminStatus) {
        throw new Error('Unauthorized: Admin access required');
    }
}

/**
 * Get the current authenticated user's ID
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
    const { userId } = await auth();
    return userId;
}
