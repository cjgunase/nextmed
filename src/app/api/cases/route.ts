import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, cases } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * GET /api/cases
 * Fetch all cases for the authenticated user
 * 
 * NOTE: This API route is maintained for backward compatibility.
 * For new development, use Server Components instead (see /app/cases/page.tsx)
 */
export async function GET() {
    try {
        // 1. Authenticate user with Clerk
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized - Authentication required',
                },
                { status: 401 }
            );
        }

        // 2. Fetch cases filtering by authenticated user's ID
        const userCases = await db.query.cases.findMany({
            where: eq(cases.userId, userId), // CRITICAL: Only return user's own cases
            with: {
                stages: {
                    orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
                    with: {
                        options: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: userCases,
            count: userCases.length,
        });
    } catch (error) {
        console.error('Error fetching cases:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch cases',
            },
            { status: 500 }
        );
    }
}
