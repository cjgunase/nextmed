'use server';

import OpenAI from 'openai';
import { and, asc, count, desc, eq, gte, ilike, lte, SQL } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
    ukmlaCategories,
    ukmlaQuestionOptions,
    ukmlaQuestions,
    difficultyLevels,
} from '@/db/schema';
import { requireAdmin, getCurrentUserId } from '@/lib/admin';
import {
    createUkmlaQuestionSchema,
    generateUkmlaBatchSchema,
    updateUkmlaQuestionSchema,
    type CreateUkmlaQuestionInput,
    type GenerateUkmlaBatchInput,
    type UpdateUkmlaQuestionInput,
} from '@/schemas/ukmla';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const adminListSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    category: z.enum(ukmlaCategories).optional(),
    difficulty: z.enum(difficultyLevels).optional(),
    verificationStatus: z.enum(['draft', 'verified', 'rejected']).optional(),
    search: z.string().trim().max(200).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

export async function getAdminUkmlaQuestions(input?: z.infer<typeof adminListSchema>) {
    await requireAdmin();

    const parsed = adminListSchema.safeParse(input ?? {});
    if (!parsed.success) {
        return {
            questions: [],
            pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
            categories: ukmlaCategories,
            difficulties: difficultyLevels,
        };
    }

    const { page, pageSize, category, difficulty, verificationStatus, search, dateFrom, dateTo } = parsed.data;
    const filters: SQL[] = [];

    if (category) filters.push(eq(ukmlaQuestions.category, category));
    if (difficulty) filters.push(eq(ukmlaQuestions.difficultyLevel, difficulty));
    if (verificationStatus) filters.push(eq(ukmlaQuestions.verificationStatus, verificationStatus));
    if (search) filters.push(ilike(ukmlaQuestions.stem, `%${search}%`));
    if (dateFrom) filters.push(gte(ukmlaQuestions.createdAt, new Date(`${dateFrom}T00:00:00.000Z`)));
    if (dateTo) filters.push(lte(ukmlaQuestions.createdAt, new Date(`${dateTo}T23:59:59.999Z`)));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [{ totalItems }] = await db
        .select({ totalItems: count() })
        .from(ukmlaQuestions)
        .where(whereClause);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

    const questions = await db.query.ukmlaQuestions.findMany({
        where: whereClause,
        orderBy: [desc(ukmlaQuestions.updatedAt)],
        limit: pageSize,
        offset: (safePage - 1) * pageSize,
        with: {
            options: {
                orderBy: [asc(ukmlaQuestionOptions.optionOrder)],
            },
            creator: {
                columns: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });

    return {
        questions,
        pagination: {
            page: safePage,
            pageSize,
            totalItems,
            totalPages,
        },
        categories: ukmlaCategories,
        difficulties: difficultyLevels,
    };
}

export async function createUkmlaQuestion(input: CreateUkmlaQuestionInput) {
    await requireAdmin();
    const creatorId = await getCurrentUserId();
    if (!creatorId) return { success: false, message: 'Unauthorized' };

    const parsed = createUkmlaQuestionSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    try {
        const [question] = await db
            .insert(ukmlaQuestions)
            .values({
                createdByUserId: creatorId,
                stem: parsed.data.stem,
                explanation: parsed.data.explanation,
                category: parsed.data.category,
                difficultyLevel: parsed.data.difficultyLevel,
                source: 'human',
                verificationStatus: 'draft',
                isPublished: false,
            })
            .returning();

        await db.insert(ukmlaQuestionOptions).values(
            parsed.data.options.map((opt, index) => ({
                questionId: question.id,
                text: opt.text,
                isCorrect: opt.isCorrect,
                optionOrder: opt.optionOrder || index + 1,
            }))
        );

        revalidatePath('/admin/ukmla');
        revalidatePath('/ukmla');

        return { success: true, data: { id: question.id } };
    } catch (error) {
        console.error('Error creating UKMLA question:', error);
        return { success: false, message: 'Failed to create question' };
    }
}

export async function updateUkmlaQuestion(input: UpdateUkmlaQuestionInput) {
    await requireAdmin();

    const parsed = updateUkmlaQuestionSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    try {
        const [updated] = await db
            .update(ukmlaQuestions)
            .set({
                stem: parsed.data.stem,
                explanation: parsed.data.explanation,
                category: parsed.data.category,
                difficultyLevel: parsed.data.difficultyLevel,
                verificationStatus: parsed.data.verificationStatus || 'draft',
                qualityScore: parsed.data.qualityScore ?? 0,
                rigourScore: parsed.data.rigourScore ?? 0,
                isPublished: parsed.data.isPublished ?? false,
                updatedAt: new Date(),
            })
            .where(eq(ukmlaQuestions.id, parsed.data.id))
            .returning({ id: ukmlaQuestions.id });

        if (!updated) {
            return { success: false, message: 'Question not found' };
        }

        await db.delete(ukmlaQuestionOptions).where(eq(ukmlaQuestionOptions.questionId, parsed.data.id));

        await db.insert(ukmlaQuestionOptions).values(
            parsed.data.options.map((opt, index) => ({
                questionId: parsed.data.id,
                text: opt.text,
                isCorrect: opt.isCorrect,
                optionOrder: opt.optionOrder || index + 1,
            }))
        );

        revalidatePath('/admin/ukmla');
        revalidatePath(`/admin/ukmla/${parsed.data.id}/edit`);
        revalidatePath('/ukmla');

        return { success: true };
    } catch (error) {
        console.error('Error updating UKMLA question:', error);
        return { success: false, message: 'Failed to update question' };
    }
}

export async function deleteUkmlaQuestion(id: number) {
    await requireAdmin();

    try {
        await db.delete(ukmlaQuestions).where(eq(ukmlaQuestions.id, id));
        revalidatePath('/admin/ukmla');
        revalidatePath('/ukmla');
        return { success: true };
    } catch (error) {
        console.error('Error deleting UKMLA question:', error);
        return { success: false, message: 'Failed to delete question' };
    }
}

export async function toggleUkmlaPublish(id: number, publish: boolean) {
    await requireAdmin();

    try {
        const question = await db.query.ukmlaQuestions.findFirst({
            where: eq(ukmlaQuestions.id, id),
            with: {
                options: true,
            },
        });

        if (!question) {
            return { success: false, message: 'Question not found' };
        }

        const correctCount = question.options.filter((opt) => opt.isCorrect).length;
        if (publish && correctCount !== 1) {
            return { success: false, message: 'Question must have exactly one correct option before publishing.' };
        }

        await db
            .update(ukmlaQuestions)
            .set({
                isPublished: publish,
                updatedAt: new Date(),
            })
            .where(eq(ukmlaQuestions.id, id));

        revalidatePath('/admin/ukmla');
        revalidatePath('/ukmla');
        return { success: true };
    } catch (error) {
        console.error('Error toggling UKMLA publish:', error);
        return { success: false, message: 'Failed to update publish status' };
    }
}

export async function generateUkmlaQuestionsAction(input: GenerateUkmlaBatchInput) {
    await requireAdmin();
    const creatorId = await getCurrentUserId();
    if (!creatorId) return { success: false, message: 'Unauthorized' };

    const parsed = generateUkmlaBatchSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    if (!process.env.OPENAI_API_KEY) {
        return { success: false, message: 'OpenAI API key is missing' };
    }

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a UKMLA question writer. Generate traditional single-best-answer MCQs with one best answer and concise educational explanation.',
                },
                {
                    role: 'user',
                    content: `Generate ${parsed.data.count} UKMLA questions.\nCategory: ${parsed.data.category}\nDifficulty: ${parsed.data.difficulty}\nPrompt: ${parsed.data.prompt}`,
                },
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'ukmla_batch_questions',
                    schema: {
                        type: 'object',
                        properties: {
                            questions: {
                                type: 'array',
                                minItems: parsed.data.count,
                                maxItems: parsed.data.count,
                                items: {
                                    type: 'object',
                                    properties: {
                                        stem: { type: 'string' },
                                        explanation: { type: 'string' },
                                        options: {
                                            type: 'array',
                                            minItems: 4,
                                            maxItems: 6,
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    text: { type: 'string' },
                                                    isCorrect: { type: 'boolean' },
                                                },
                                                required: ['text', 'isCorrect'],
                                                additionalProperties: false,
                                            },
                                        },
                                    },
                                    required: ['stem', 'explanation', 'options'],
                                    additionalProperties: false,
                                },
                            },
                        },
                        required: ['questions'],
                        additionalProperties: false,
                    },
                },
            },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            return { success: false, message: 'No content returned from model' };
        }

        const responseSchema = z.object({
            questions: z
                .array(
                    z.object({
                        stem: z.string().min(10).max(4000),
                        explanation: z.string().min(10).max(4000),
                        options: z.array(
                            z.object({
                                text: z.string().min(1).max(500),
                                isCorrect: z.boolean(),
                            })
                        ),
                    })
                )
                .min(parsed.data.count)
                .max(parsed.data.count),
        });

        const json = JSON.parse(content);
        const validated = responseSchema.parse(json);

        const createdIds: number[] = [];

        for (const question of validated.questions) {
            const normalizedOptions = question.options.slice(0, 8);
            const firstCorrectIndex = normalizedOptions.findIndex((opt) => opt.isCorrect);

            const optionsWithSingleCorrect = normalizedOptions.map((opt, index) => ({
                ...opt,
                isCorrect: firstCorrectIndex === -1 ? index === 0 : index === firstCorrectIndex,
            }));

            const [insertedQuestion] = await db
                .insert(ukmlaQuestions)
                .values({
                    createdByUserId: creatorId,
                    stem: question.stem,
                    explanation: question.explanation,
                    category: parsed.data.category,
                    difficultyLevel: parsed.data.difficulty,
                    source: 'ai',
                    verificationStatus: 'draft',
                    qualityScore: 50,
                    rigourScore: 0,
                    isPublished: false,
                })
                .returning({ id: ukmlaQuestions.id });

            await db.insert(ukmlaQuestionOptions).values(
                optionsWithSingleCorrect.map((opt, index) => ({
                    questionId: insertedQuestion.id,
                    text: opt.text,
                    isCorrect: opt.isCorrect,
                    optionOrder: index + 1,
                }))
            );

            createdIds.push(insertedQuestion.id);
        }

        revalidatePath('/admin/ukmla');

        return { success: true, data: { createdIds } };
    } catch (error) {
        console.error('Error generating UKMLA questions:', error);
        return { success: false, message: 'Failed to generate questions' };
    }
}
