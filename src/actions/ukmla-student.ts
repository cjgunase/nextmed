'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { and, asc, desc, eq, inArray, like, lte, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
    difficultyLevels,
    ukmlaCategories,
    ukmlaQuestionOptions,
    ukmlaQuestions,
    ukmlaAttempts,
    ukmlaUserStats,
    ukmlaCategoryStats,
    ukmlaDifficultyStats,
    ukmlaSpacedRepetitionCards,
    users,
} from '@/db/schema';
import {
    recordUkmlaAttemptSchema,
    type RecordUkmlaAttemptInput,
    ukmlaQueryFilterSchema,
    type UkmlaQueryFilterInput,
} from '@/schemas/ukmla';

type DifficultyLevel = (typeof difficultyLevels)[number];

function calculateAttemptScore(difficultyLevel: DifficultyLevel, isCorrect: boolean): number {
    if (difficultyLevel === 'Foundation') return isCorrect ? 10 : -2;
    if (difficultyLevel === 'Core') return isCorrect ? 15 : -3;
    return isCorrect ? 20 : -4;
}

async function ensureCurrentUserInDb(userId: string) {
    const user = await currentUser();
    if (!user?.id) return;

    const adminEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);

    const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
    const role = userEmail && adminEmails.includes(userEmail) ? 'admin' : 'student';

    await db
        .insert(users)
        .values({
            id: userId,
            email: user.emailAddresses[0]?.emailAddress || `${userId}@unknown.local`,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            imageUrl: user.imageUrl || null,
            role,
        })
        .onConflictDoNothing();
}

export async function getUkmlaQuestions(input?: UkmlaQueryFilterInput) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [], total: 0, totalPages: 0 };
    }

    const parsed = ukmlaQueryFilterSchema.safeParse(input ?? {});
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid filters', data: [], total: 0, totalPages: 0 };
    }

    const { page, pageSize, category, difficulty, search, status } = parsed.data;
    const filters = [eq(ukmlaQuestions.isPublished, true)];

    if (category) {
        filters.push(eq(ukmlaQuestions.category, category));
    }

    if (difficulty) {
        filters.push(eq(ukmlaQuestions.difficultyLevel, difficulty));
    }

    if (search) {
        filters.push(
            or(
                like(ukmlaQuestions.stem, `%${search}%`),
                like(ukmlaQuestions.explanation, `%${search}%`)
            )!
        );
    }

    if (status === 'due') {
        const dueRows = await db
            .select({ questionId: ukmlaSpacedRepetitionCards.questionId })
            .from(ukmlaSpacedRepetitionCards)
            .where(
                and(
                    eq(ukmlaSpacedRepetitionCards.userId, userId),
                    lte(ukmlaSpacedRepetitionCards.nextReviewDate, new Date())
                )
            );

        const dueIds = dueRows.map((row) => row.questionId);
        if (dueIds.length === 0) {
            return {
                success: true,
                data: [],
                total: 0,
                totalPages: 0,
                page,
                pageSize,
                categories: ukmlaCategories,
                difficulties: difficultyLevels,
            };
        }

        filters.push(inArray(ukmlaQuestions.id, dueIds));
    }

    const whereClause = and(...filters);

    const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ukmlaQuestions)
        .where(whereClause);

    const total = Number(count || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

    const rows = await db.query.ukmlaQuestions.findMany({
        where: whereClause,
        orderBy: [desc(ukmlaQuestions.updatedAt)],
        limit: pageSize,
        offset: (safePage - 1) * pageSize,
        with: {
            options: {
                orderBy: [asc(ukmlaQuestionOptions.optionOrder)],
                columns: { id: true },
            },
            spacedRepetitionCards: {
                where: eq(ukmlaSpacedRepetitionCards.userId, userId),
                columns: { nextReviewDate: true },
                limit: 1,
            },
        },
    });

    const data = rows.map((row) => ({
        ...row,
        optionsCount: row.options.length,
        nextReviewDate: row.spacedRepetitionCards[0]?.nextReviewDate || null,
        isDue:
            row.spacedRepetitionCards[0]?.nextReviewDate
                ? new Date(row.spacedRepetitionCards[0].nextReviewDate) <= new Date()
                : false,
    }));

    return {
        success: true,
        data,
        total,
        totalPages,
        page: safePage,
        pageSize,
        categories: ukmlaCategories,
        difficulties: difficultyLevels,
    };
}

export async function loadUkmlaQuestionForAttempt(questionId: number) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: null };
    }

    const question = await db.query.ukmlaQuestions.findFirst({
        where: and(
            eq(ukmlaQuestions.id, questionId),
            or(eq(ukmlaQuestions.isPublished, true), eq(ukmlaQuestions.createdByUserId, userId))
        ),
        with: {
            options: {
                orderBy: [asc(ukmlaQuestionOptions.optionOrder)],
            },
        },
    });

    if (!question) {
        return { success: false, message: 'Question not found', data: null };
    }

    return { success: true, data: question };
}

export async function recordUkmlaAttempt(input: RecordUkmlaAttemptInput) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = recordUkmlaAttemptSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    try {
        await ensureCurrentUserInDb(userId);

        const question = await db.query.ukmlaQuestions.findFirst({
            where: eq(ukmlaQuestions.id, parsed.data.questionId),
            with: {
                options: true,
            },
        });

        if (!question) {
            return { success: false, message: 'Question not found' };
        }

        const selectedOption = question.options.find((opt) => opt.id === parsed.data.selectedOptionId);
        if (!selectedOption) {
            return { success: false, message: 'Invalid option for question' };
        }

        const isCorrect = selectedOption.isCorrect;
        const score = calculateAttemptScore(question.difficultyLevel as DifficultyLevel, isCorrect);

        await db.insert(ukmlaAttempts).values({
            userId,
            questionId: question.id,
            selectedOptionId: selectedOption.id,
            isCorrect,
            score,
        });

        const currentUserStats = await db.query.ukmlaUserStats.findFirst({
            where: eq(ukmlaUserStats.userId, userId),
        });

        if (currentUserStats) {
            const nextAttempts = currentUserStats.totalAttempts + 1;
            const nextCorrect = currentUserStats.totalCorrect + (isCorrect ? 1 : 0);
            const nextScore = currentUserStats.totalScore + score;
            const nextAvg = Math.round((nextCorrect / nextAttempts) * 100);

            await db
                .update(ukmlaUserStats)
                .set({
                    totalAttempts: nextAttempts,
                    totalCorrect: nextCorrect,
                    totalScore: nextScore,
                    averageScore: nextAvg,
                    lastActivityAt: new Date(),
                })
                .where(eq(ukmlaUserStats.userId, userId));
        } else {
            await db.insert(ukmlaUserStats).values({
                userId,
                totalAttempts: 1,
                totalCorrect: isCorrect ? 1 : 0,
                totalScore: score,
                averageScore: isCorrect ? 100 : 0,
                lastActivityAt: new Date(),
            });
        }

        const currentCategoryStats = await db.query.ukmlaCategoryStats.findFirst({
            where: and(
                eq(ukmlaCategoryStats.userId, userId),
                eq(ukmlaCategoryStats.category, question.category)
            ),
        });

        if (currentCategoryStats) {
            const nextAttempts = currentCategoryStats.totalAttempts + 1;
            const nextCorrect = currentCategoryStats.totalCorrect + (isCorrect ? 1 : 0);
            const nextScore = currentCategoryStats.totalScore + score;
            const nextAvg = Math.round((nextCorrect / nextAttempts) * 100);

            await db
                .update(ukmlaCategoryStats)
                .set({
                    totalAttempts: nextAttempts,
                    totalCorrect: nextCorrect,
                    totalScore: nextScore,
                    averageScore: nextAvg,
                    lastAttemptAt: new Date(),
                })
                .where(
                    and(
                        eq(ukmlaCategoryStats.userId, userId),
                        eq(ukmlaCategoryStats.category, question.category)
                    )
                );
        } else {
            await db.insert(ukmlaCategoryStats).values({
                userId,
                category: question.category,
                totalAttempts: 1,
                totalCorrect: isCorrect ? 1 : 0,
                totalScore: score,
                averageScore: isCorrect ? 100 : 0,
                lastAttemptAt: new Date(),
            });
        }

        const currentDifficultyStats = await db.query.ukmlaDifficultyStats.findFirst({
            where: and(
                eq(ukmlaDifficultyStats.userId, userId),
                eq(ukmlaDifficultyStats.difficultyLevel, question.difficultyLevel)
            ),
        });

        if (currentDifficultyStats) {
            const nextAttempts = currentDifficultyStats.totalAttempts + 1;
            const nextCorrect = currentDifficultyStats.totalCorrect + (isCorrect ? 1 : 0);
            const nextScore = currentDifficultyStats.totalScore + score;
            const nextAvg = Math.round((nextCorrect / nextAttempts) * 100);

            await db
                .update(ukmlaDifficultyStats)
                .set({
                    totalAttempts: nextAttempts,
                    totalCorrect: nextCorrect,
                    totalScore: nextScore,
                    averageScore: nextAvg,
                    lastAttemptAt: new Date(),
                })
                .where(
                    and(
                        eq(ukmlaDifficultyStats.userId, userId),
                        eq(ukmlaDifficultyStats.difficultyLevel, question.difficultyLevel)
                    )
                );
        } else {
            await db.insert(ukmlaDifficultyStats).values({
                userId,
                difficultyLevel: question.difficultyLevel,
                totalAttempts: 1,
                totalCorrect: isCorrect ? 1 : 0,
                totalScore: score,
                averageScore: isCorrect ? 100 : 0,
                lastAttemptAt: new Date(),
            });
        }

        const existingCard = await db.query.ukmlaSpacedRepetitionCards.findFirst({
            where: and(
                eq(ukmlaSpacedRepetitionCards.userId, userId),
                eq(ukmlaSpacedRepetitionCards.questionId, question.id)
            ),
        });

        const quality = isCorrect ? 5 : 2;
        let nextInterval = 1;
        let nextRepetitions = 0;
        let nextEaseFactor = existingCard?.easeFactor || 2500;

        if (existingCard) {
            if (quality >= 3) {
                nextRepetitions = existingCard.repetitions + 1;
                if (nextRepetitions === 1) nextInterval = 1;
                else if (nextRepetitions === 2) nextInterval = 6;
                else nextInterval = Math.max(1, Math.round(existingCard.interval * (existingCard.easeFactor / 1000)));

                nextEaseFactor = Math.max(
                    1300,
                    Math.round(existingCard.easeFactor + (100 * (3.6 - (5 - quality) * (0.08 + (5 - quality) * 0.02))))
                );
            } else {
                nextRepetitions = 0;
                nextInterval = 1;
                nextEaseFactor = existingCard.easeFactor;
            }

            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

            await db
                .update(ukmlaSpacedRepetitionCards)
                .set({
                    repetitions: nextRepetitions,
                    easeFactor: nextEaseFactor,
                    interval: nextInterval,
                    nextReviewDate,
                    lastReviewedAt: new Date(),
                })
                .where(eq(ukmlaSpacedRepetitionCards.id, existingCard.id));
        } else {
            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + 1);

            await db.insert(ukmlaSpacedRepetitionCards).values({
                userId,
                questionId: question.id,
                repetitions: 0,
                easeFactor: 2500,
                interval: 1,
                nextReviewDate,
                lastReviewedAt: new Date(),
            });
        }

        revalidatePath('/ukmla');
        revalidatePath('/ukmla/review');
        revalidatePath('/leaderboard');
        revalidatePath('/performance');

        return {
            success: true,
            data: {
                questionId: question.id,
                isCorrect,
                score,
                explanation: question.explanation,
            },
        };
    } catch (error) {
        console.error('Error recording UKMLA attempt:', error);
        return { success: false, message: 'Failed to record attempt' };
    }
}

export async function getUkmlaReviewQueue(limit = 50) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    try {
        const now = new Date();
        const cards = await db.query.ukmlaSpacedRepetitionCards.findMany({
            where: and(
                eq(ukmlaSpacedRepetitionCards.userId, userId),
                lte(ukmlaSpacedRepetitionCards.nextReviewDate, now)
            ),
            orderBy: [asc(ukmlaSpacedRepetitionCards.nextReviewDate)],
            limit,
            with: {
                question: {
                    with: {
                        options: {
                            orderBy: [asc(ukmlaQuestionOptions.optionOrder)],
                        },
                    },
                },
            },
        });

        return { success: true, data: cards };
    } catch (error) {
        console.error('Error getting UKMLA review queue:', error);
        return { success: false, message: 'Failed to get review queue', data: [] };
    }
}

export async function getUkmlaDueReviewCount() {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', count: 0 };
    }

    try {
        const rows = await db
            .select({ count: sql<number>`count(*)` })
            .from(ukmlaSpacedRepetitionCards)
            .where(
                and(
                    eq(ukmlaSpacedRepetitionCards.userId, userId),
                    lte(ukmlaSpacedRepetitionCards.nextReviewDate, new Date())
                )
            );

        return { success: true, count: Number(rows[0]?.count || 0) };
    } catch (error) {
        console.error('Error getting UKMLA due review count:', error);
        return { success: false, message: 'Failed to get due review count', count: 0 };
    }
}
