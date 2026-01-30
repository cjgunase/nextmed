import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, cases } from '@/db';
import { eq, and } from 'drizzle-orm';
import { caseIdSchema } from '@/schemas/case';

/**
 * GET /api/cases/[id]
 * Fetch a single medical case by ID (only if user owns it)
 * 
 * NOTE: This API route is maintained for backward compatibility.
 * For new development, use Server Components instead (see /app/cases/[id]/page.tsx)
 */
export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
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

        // 2. Validate case ID with Zod
        const validationResult = caseIdSchema.safeParse(params);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid case ID',
                    details: validationResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { id: caseId } = validationResult.data;

        // 3. Fetch case with ownership verification
        const medicalCase = await db.query.cases.findFirst({
            where: and(
                eq(cases.id, caseId),
                eq(cases.userId, userId) // CRITICAL: User can only access their own cases
            ),
            with: {
                stages: {
                    orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
                    with: {
                        options: true,
                    },
                },
            },
        });

        // 4. Return 404 if case not found or user doesn't own it
        if (!medicalCase) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Case not found or access denied',
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: medicalCase,
        });
    } catch (error) {
        console.error('Error fetching case:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch case',
            },
            { status: 500 }
        );
    }
}
