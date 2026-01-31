'use server';

import { db } from '@/db';
import { cases } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getSimulation(caseId: number) {
    const simulation = await db.query.cases.findFirst({
        where: eq(cases.id, caseId),
        with: {
            stages: {
                orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
                with: {
                    options: true,
                },
            },
        },
    });

    return simulation;
}
