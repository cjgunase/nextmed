'use server';

import { db } from '@/db';
import { cases, caseStages, stageOptions, DifficultyLevel } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, getCurrentUserId } from '@/lib/admin';

// Schemas
const createCaseSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    clinicalDomain: z.string().min(1, 'Clinical Domain is required'),
    difficultyLevel: z.enum(['Foundation', 'Core', 'Advanced']),
    userId: z.string().min(1, 'User ID is required'),
});

const createStageSchema = z.object({
    caseId: z.coerce.number(), // Coerce from string if coming from formdata
    stageOrder: z.coerce.number(),
    narrative: z.string().min(1, 'Narrative is required'),
    clinicalData: z.string().transform((val) => {
        try {
            return val ? JSON.parse(val) : {};
        } catch {
            return {};
        }
    }),
});

const createOptionSchema = z.object({
    stageId: z.coerce.number(),
    text: z.string().min(1, 'Text is required'),
    isCorrect: z.boolean(),
    scoreWeight: z.coerce.number(),
    feedback: z.string().min(1, 'Feedback is required'),
});


export async function getAllCases() {
    await requireAdmin();

    return await db.query.cases.findMany({
        orderBy: [desc(cases.createdAt)],
        with: {
            stages: {
                orderBy: [asc(caseStages.stageOrder)],
                with: {
                    options: true
                }
            }
        }
    });
}

export async function createCase(data: z.infer<typeof createCaseSchema>) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = createCaseSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    try {
        const result = await db.insert(cases).values({
            ...parsed.data,
            isPublished: false,
        }).returning();

        revalidatePath('/admin');
        return { success: true, caseId: result[0].id, message: 'Case created' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

export async function createStage(data: any) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = createStageSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    try {
        const result = await db.insert(caseStages).values({
            caseId: parsed.data.caseId,
            stageOrder: parsed.data.stageOrder,
            narrative: parsed.data.narrative,
            clinicalData: parsed.data.clinicalData,
        }).returning();

        revalidatePath('/admin');
        return { success: true, stageId: result[0].id, message: 'Stage created' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

export async function createOption(data: z.infer<typeof createOptionSchema>) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = createOptionSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    try {
        await db.insert(stageOptions).values(parsed.data);
        revalidatePath('/admin');
        return { success: true, message: 'Option added' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

export async function deleteCase(caseId: number) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }
    try {
        await db.delete(cases).where(eq(cases.id, caseId));
        revalidatePath('/admin');
        return { success: true, message: 'Case deleted' };
    } catch (e) {
        return { success: false, message: 'Database error' };
    }
}

export async function togglePublish(caseId: number, isPublished: boolean) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    try {
        // If publishing, validate that case is complete
        if (isPublished) {
            const caseWithStages = await db.query.cases.findFirst({
                where: eq(cases.id, caseId),
                with: {
                    stages: {
                        with: {
                            options: true
                        }
                    }
                }
            });

            if (!caseWithStages) {
                return { success: false, message: 'Case not found' };
            }

            // Validation: Must have at least one stage
            if (caseWithStages.stages.length === 0) {
                return {
                    success: false,
                    message: '❌ Cannot publish: Case must have at least one stage'
                };
            }

            // Validation: Each stage must have at least one option
            const stagesWithoutOptions = caseWithStages.stages.filter(
                stage => stage.options.length === 0
            );

            if (stagesWithoutOptions.length > 0) {
                return {
                    success: false,
                    message: `❌ Cannot publish: Stage ${stagesWithoutOptions[0].stageOrder} has no options. All stages must have at least one option.`
                };
            }

            // Additional validation: At least one option must be marked as correct
            const stagesWithoutCorrectOption = caseWithStages.stages.filter(
                stage => !stage.options.some(opt => opt.isCorrect)
            );

            if (stagesWithoutCorrectOption.length > 0) {
                return {
                    success: false,
                    message: `⚠️  Warning: Stage ${stagesWithoutCorrectOption[0].stageOrder} has no correct option. Consider marking at least one option as correct.`,
                    warning: true // Still allow publishing but warn admin
                };
            }
        }

        // Validation passed or unpublishing - proceed with update
        await db.update(cases)
            .set({ isPublished, updatedAt: new Date() })
            .where(eq(cases.id, caseId));

        revalidatePath('/admin');
        revalidatePath('/cases');
        return {
            success: true,
            message: `✅ Case ${isPublished ? 'published successfully!' : 'unpublished'}`
        };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

// Keep the old generation function just in case, but strictly we don't need it if manual is preferred. 
// I'll keep it as a fallback tool.
export async function generatePatient() {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
        return { success: false, message: 'Not authenticated' };
    }

    try {
        // Hardcoded new case data (simulating AI generation)
        // Scenario: Acute Hypoglycemia
        const newCase = await db.insert(cases).values({
            userId, // Current admin user from Clerk
            title: 'Acute Confusion in Type 1 Diabetic (Generated)',
            description: 'A 24-year-old male with Type 1 Diabetes is found confused and sweating profusely by his roommate.',
            clinicalDomain: 'Endocrinology',
            difficultyLevel: 'Foundation',
            isPublished: true,
        }).returning();

        const caseId = newCase[0].id;

        // Stage 1
        const stage1 = await db.insert(caseStages).values({
            caseId: caseId,
            stageOrder: 1,
            narrative: 'A 24-year-old male is brought to A&E by ambulance. His roommate found him confused, agitated, and sweating profusely. He was last seen normal 2 hours ago. He has Type 1 Diabetes. On exam: GCS 14/15 (confused), diaphoretic, tachycardia.',
            clinicalData: {
                BP: '130/80',
                HR: 110,
                RR: 20,
                SpO2: 98,
                Temp: 36.5,
                notes: ['Profuse sweating', 'Agitated behavior'],
            },
        }).returning();

        await db.insert(stageOptions).values([
            {
                stageId: stage1[0].id,
                text: 'Check Capillary Blood Glucose (CBG) immediately',
                isCorrect: true,
                scoreWeight: 2,
                feedback: 'Correct! In any confused diabetic patient (or any confused patient), hypoglycemia must be excluded immediately. It is a reversible cause of coma.',
            },
            {
                stageId: stage1[0].id,
                text: 'Perform CT Head to rule out trauma',
                isCorrect: false,
                scoreWeight: -3,
                feedback: 'Incorrect. While trauma is a differential, hypoglycemia is far more likely and rapidly treatable. CT takes too long.',
            },
            {
                stageId: stage1[0].id,
                text: 'Administer 10 units Insulin SC',
                isCorrect: false,
                scoreWeight: -5,
                feedback: 'Dangerous! If the patient is hypoglycemic, insulin could be fatal. Never give insulin without checking glucose.',
            },
        ]);

        // Stage 2
        const stage2 = await db.insert(caseStages).values({
            caseId: caseId,
            stageOrder: 2,
            narrative: 'CBG is 2.1 mmol/L. The patient is conscious but unable to swallow safely due to agitation.',
            clinicalData: {
                CBG: '2.1 mmol/L',
                Status: 'Unable to swallow safely',
            },
        }).returning();

        await db.insert(stageOptions).values([
            {
                stageId: stage2[0].id,
                text: 'Administer IV 10% Dextrose (150-200ml) or IM Glucagon',
                isCorrect: true,
                scoreWeight: 2,
                feedback: 'Correct! If unable to swallow, parenteral treatment is needed. IV Dextrose is preferred in hospital. IM Glucagon is an alternative if no IV access.',
            },
            {
                stageId: stage2[0].id,
                text: 'Force feed oral glucose gel',
                isCorrect: false,
                scoreWeight: -4,
                feedback: 'Unsafe! Risk of aspiration if patient cannot swallow safely.',
            },
        ]);

        revalidatePath('/cases');
        return { success: true, message: 'Patient generated successfully!', caseId: caseId };

    } catch (error) {
        console.error('Error generating patient:', error);
        return { success: false, message: 'Failed to generate patient' };
    }
}

// ============================================================================
// UPDATE ACTIONS - Allow full editing of all fields
// ============================================================================

const updateCaseSchema = z.object({
    id: z.number(),
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    clinicalDomain: z.string().min(1, 'Clinical Domain is required'),
    difficultyLevel: z.enum(['Foundation', 'Core', 'Advanced']),
    verificationStatus: z.string().optional(),
    qualityScore: z.number().min(0).max(100).optional(),
    rigourScore: z.number().min(0).max(100).optional(),
});

export async function updateCase(data: z.infer<typeof updateCaseSchema>) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = updateCaseSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    try {
        await db.update(cases)
            .set({
                title: parsed.data.title,
                description: parsed.data.description,
                clinicalDomain: parsed.data.clinicalDomain,
                difficultyLevel: parsed.data.difficultyLevel,
                verificationStatus: parsed.data.verificationStatus,
                qualityScore: parsed.data.qualityScore,
                rigourScore: parsed.data.rigourScore,
                updatedAt: new Date(),
            })
            .where(eq(cases.id, parsed.data.id));

        revalidatePath('/admin');
        revalidatePath('/cases');
        return { success: true, message: 'Case updated successfully' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

const updateStageSchema = z.object({
    id: z.number(),
    narrative: z.string().min(1, 'Narrative is required'),
    clinicalData: z.union([
        z.string().transform((val) => {
            try {
                return val ? JSON.parse(val) : {};
            } catch {
                return {};
            }
        }),
        z.object({}).passthrough()
    ]),
    mediaUrl: z.string().optional().nullable(),
});

export async function updateStage(data: z.infer<typeof updateStageSchema>) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = updateStageSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    try {
        await db.update(caseStages)
            .set({
                narrative: parsed.data.narrative,
                clinicalData: parsed.data.clinicalData,
                mediaUrl: parsed.data.mediaUrl,
            })
            .where(eq(caseStages.id, parsed.data.id));

        revalidatePath('/admin');
        return { success: true, message: 'Stage updated successfully' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

const updateOptionSchema = z.object({
    id: z.number(),
    text: z.string().min(1, 'Text is required'),
    isCorrect: z.boolean(),
    scoreWeight: z.number(),
    feedback: z.string().min(1, 'Feedback is required'),
});

export async function updateOption(data: z.infer<typeof updateOptionSchema>) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = updateOptionSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    try {
        await db.update(stageOptions)
            .set({
                text: parsed.data.text,
                isCorrect: parsed.data.isCorrect,
                scoreWeight: parsed.data.scoreWeight,
                feedback: parsed.data.feedback,
            })
            .where(eq(stageOptions.id, parsed.data.id));

        revalidatePath('/admin');
        return { success: true, message: 'Option updated successfully' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Database error' };
    }
}

export async function deleteStage(stageId: number) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }
    try {
        await db.delete(caseStages).where(eq(caseStages.id, stageId));
        revalidatePath('/admin');
        return { success: true, message: 'Stage deleted' };
    } catch (e) {
        return { success: false, message: 'Database error' };
    }
}

export async function deleteOption(optionId: number) {
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }
    try {
        await db.delete(stageOptions).where(eq(stageOptions.id, optionId));
        revalidatePath('/admin');
        return { success: true, message: 'Option deleted' };
    } catch (e) {
        return { success: false, message: 'Database error' };
    }
}
