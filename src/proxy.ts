import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher([
    '/api/cases(.*)',      // All case API routes require auth
    '/api/user(.*)',       // All user-specific API routes
    '/dashboard(.*)',      // Dashboard and admin pages
    '/cases/new(.*)',      // Case creation pages
    '/cases/edit(.*)',     // Case editing pages
]);

export default clerkMiddleware(async (auth, req) => {
    // Protect routes that require authentication
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
