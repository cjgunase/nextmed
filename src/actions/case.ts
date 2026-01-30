'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
    createCaseSchema,
    updateCaseSchema,
    togglePublishSchema,
    type CreateCaseInput,
    type UpdateCaseInput,
    type TogglePublishInput,
} from '@/schemas/case';

// ============================================================================
// CASE ACTIONS
// ============================================================================

/**
 * Create a new medical case
 * @returns Created case or error
 */
export async function createCase(data: CreateCaseInput) {
    try {
        // 1. Authenticate user
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        // 2. Validate input with Zod
        const validated = createCaseSchema.parse(data);

        // 3. Insert into database with userId
        const [newCase] = await db
            .insert(cases)
            .values({
                ...validated,
                userId, // CRITICAL: Always use authenticated userId
            })
            .returning();

        // 4. Revalidate relevant pages
        revalidatePath('/cases');
        revalidatePath('/dashboard');

        return { success: true, data: newCase };
    } catch (error) {
        console.error('Error creating case:', error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Failed to create case' };
    }
}

/**
 * Update an existing case (only if user owns it)
 * @returns Updated case or error
 */
export async function updateCase(data: UpdateCaseInput) {
    try {
        // 1. Authenticate user
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        // 2. Validate input with Zod
        const validated = updateCaseSchema.parse(data);

        // 3. Verify ownership before update
        const existingCase = await db.query.cases.findFirst({
            where: and(
                eq(cases.id, validated.id),
                eq(cases.userId, userId) // CRITICAL: User can only update their own cases
            ),
        });

        if (!existingCase) {
            return { success: false, error: 'Case not found or access denied' };
        }

        // 4. Update the case
        const { id, ...updateData } = validated;
        const [updatedCase] = await db
            .update(cases)
            .set({
                ...updateData,
                updatedAt: new Date(),
            })
            .where(and(
                eq(cases.id, id),
                eq(cases.userId, userId) // Double-check ownership
            ))
            .returning();

        // 5. Revalidate relevant pages
        revalidatePath('/cases');
        revalidatePath(`/cases/${id}`);
        revalidatePath('/dashboard');

        return { success: true, data: updatedCase };
    } catch (error) {
        console.error('Error updating case:', error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Failed to update case' };
    }
}

/**
 * Delete a case (only if user owns it)
 * @returns Success status or error
 */
export async function deleteCase(caseId: number) {
    try {
        // 1. Authenticate user
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        // 2. Verify ownership before deletion
        const existingCase = await db.query.cases.findFirst({
            where: and(
                eq(cases.id, caseId),
                eq(cases.userId, userId)
            ),
        });

        if (!existingCase) {
            return { success: false, error: 'Case not found or access denied' };
        }

        // 3. Delete the case (cascade will handle related records)
        await db
            .delete(cases)
            .where(and(
                eq(cases.id, caseId),
                eq(cases.userId, userId) // CRITICAL: Only delete if user owns it
            ));

        // 4. Revalidate relevant pages
        revalidatePath('/cases');
        revalidatePath('/dashboard');

        return { success: true, message: 'Case deleted successfully' };
    } catch (error) {
        console.error('Error deleting case:', error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Failed to delete case' };
    }
}

/**
 * Toggle case publication status (only if user owns it)
 * @returns Updated case or error
 */
export async function toggleCasePublish(data: TogglePublishInput) {
    try {
        // 1. Authenticate user
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        // 2. Validate input with Zod
        const validated = togglePublishSchema.parse(data);

        // 3. Verify ownership
        const existingCase = await db.query.cases.findFirst({
            where: and(
                eq(cases.id, validated.id),
                eq(cases.userId, userId)
            ),
        });

        if (!existingCase) {
            return { success: false, error: 'Case not found or access denied' };
        }

        // 4. Update publication status
        const [updatedCase] = await db
            .update(cases)
            .set({
                isPublished: validated.isPublished,
                updatedAt: new Date(),
            })
            .where(and(
                eq(cases.id, validated.id),
                eq(cases.userId, userId)
            ))
            .returning();

        // 5. Revalidate relevant pages
        revalidatePath('/cases');
        revalidatePath(`/cases/${validated.id}`);
        revalidatePath('/dashboard');

        return { success: true, data: updatedCase };
    } catch (error) {
        console.error('Error toggling case publish status:', error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Failed to update case' };
    }
}

/**
 * Get all cases for the authenticated user
 * This is a helper action for client components that need to fetch data
 * Note: Prefer Server Components for initial data fetching
 */
export async function getUserCases() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        const userCases = await db.query.cases.findMany({
            where: eq(cases.userId, userId),
            with: {
                stages: {
                    orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
                    with: {
                        options: true,
                    },
                },
            },
        });

        return { success: true, data: userCases };
    } catch (error) {
        console.error('Error fetching user cases:', error);
        return { success: false, error: 'Failed to fetch cases' };
    }
}
