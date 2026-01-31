'use server';

import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { CaseWithStagesAndOptions } from '@/types/simulator-types';

/**
 * Loads a case for the simulator.
 * 
 * Rules:
 * 1. If the case is PUBLISHED, anyone can play it.
 * 2. If the case is DRAFT (not published), only the OWNER can play it (for testing).
 */
export async function loadCaseForSimulator(caseId: number): Promise<CaseWithStagesAndOptions | null> {
    const { userId } = await auth();

    // conditions: 
    // (id = caseId) AND (isPublished = true OR (userId != null AND userId = caseOwnerId))

    // We can't easily do the OR check in a single simple query builder call without raw SQL or helper
    // so we'll fetch the case first and then check permissions in code, or use advanced where clause.
    // Let's use the code check for clarity and security.

    const medicalCase = await db.query.cases.findFirst({
        where: eq(cases.id, caseId),
        with: {
            stages: {
                orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
                with: {
                    options: true,
                }
            }
        }
    });

    if (!medicalCase) {
        return null;
    }

    // Permission check
    const isOwner = userId && medicalCase.userId === userId;
    const isPublished = medicalCase.isPublished;

    if (!isPublished && !isOwner) {
        return null; // Not allowed to see draft if not owner
    }

    // Cast the result to our strict type to ensure it matches what the frontend expects
    // The query result should match the shape, but Drizzle types can be complex
    return medicalCase as unknown as CaseWithStagesAndOptions;
}
