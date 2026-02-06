import { isAdmin } from '@/lib/admin';
import { currentUser } from '@clerk/nextjs/server';
import AdminDashboard from './admin-dashboard';

export default async function AdminPage() {
    // Middleware ensures user is authenticated, so we can safely get current user
    const user = await currentUser();

    if (!user) {
        // This should rarely happen due to middleware, but just in case
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <div className="max-w-md w-full bg-muted border rounded-lg p-6 text-center">
                    <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
                    <p className="text-muted-foreground">
                        Please sign in to access the admin page.
                    </p>
                </div>
            </div>
        );
    }

    // Check if user has admin privileges
    const adminStatus = await isAdmin();
    const userEmail = user.emailAddresses[0]?.emailAddress;

    if (!adminStatus) {
        // Show unauthorized message if not admin
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <div className="max-w-md w-full bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
                    <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-4">
                        You don&apos;t have admin privileges to access this page.
                    </p>
                    {userEmail && (
                        <p className="text-sm text-muted-foreground">
                            Logged in as: <span className="font-mono">{userEmail}</span>
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">
                        Contact an administrator if you believe this is an error.
                    </p>
                </div>
            </div>
        );
    }

    // User is authenticated and has admin privileges
    return <AdminDashboard userEmail={userEmail || ''} userId={user.id} />;
}
