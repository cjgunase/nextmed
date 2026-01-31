import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
    // Custom Admin Auth Logic
    if (req.nextUrl.pathname.startsWith('/admin')) {
        const adminToken = process.env.ADMIN_ACCESS_TOKEN;
        const tokenCookie = req.cookies.get('admin_token');
        const tokenParam = req.nextUrl.searchParams.get('token');

        // Case 1: Already has valid cookie
        if (tokenCookie && tokenCookie.value === adminToken) {
            return NextResponse.next();
        }

        // Case 2: Has valid query param -> Set cookie and redirect to clean URL
        if (tokenParam && tokenParam === adminToken) {
            const response = NextResponse.redirect(new URL('/admin', req.url));
            response.cookies.set('admin_token', tokenParam, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7 // 1 week
            });
            return response;
        }

        // Case 3: Unauthorized -> Redirect to home
        return NextResponse.redirect(new URL('/', req.url));
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
