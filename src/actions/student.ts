'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import {
    studentAttempts,
    userStats,
    users,
    cases,
    caseStages,
    stageOptions,
    categoryStats,
    difficultyStats,
    spacedRepetitionCards,
    ukmlaAttempts,
    ukmlaCategoryStats,
    ukmlaDifficultyStats,
    ukmlaUserStats,
} from '@/db/schema';
import { eq, desc, sql, and, lte, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const difficultyLevels = ['Foundation', 'Core', 'Advanced'] as const;
export type AnalyticsMode = 'all' | 'cases' | 'ukmla';

/**
 * Record a student's completion of a case simulation
 * Also updates category stats, difficulty stats, and spaced repetition scheduling
 */
export async function recordAttempt(caseId: number, selectedOptionIds: number[]) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    try {
        if (!selectedOptionIds || selectedOptionIds.length === 0) {
            return { success: false, message: 'No options selected' };
        }

        const user = await currentUser();
        if (user?.id) {
            const adminEmailsString = process.env.ADMIN_EMAILS || '';
            const adminEmails = adminEmailsString
                .split(',')
                .map(email => email.trim().toLowerCase())
                .filter(email => email.length > 0);
            const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
            const role = userEmail && adminEmails.includes(userEmail) ? 'admin' : 'student';

            await db.insert(users).values({
                id: user.id,
                email: user.emailAddresses[0]?.emailAddress || `${user.id}@unknown.local`,
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                imageUrl: user.imageUrl || null,
                role,
            }).onConflictDoNothing();
        }

        // Fetch the case to get clinicalDomain and difficultyLevel
        const caseData = await db.query.cases.findFirst({
            where: eq(cases.id, caseId),
            columns: {
                clinicalDomain: true,
                difficultyLevel: true,
            },
        });

        if (!caseData) {
            return { success: false, message: 'Case not found' };
        }

        // Calculate score server-side from selected option IDs for this case
        const optionRows = await db
            .select({ scoreWeight: stageOptions.scoreWeight, optionId: stageOptions.id })
            .from(stageOptions)
            .innerJoin(caseStages, eq(stageOptions.stageId, caseStages.id))
            .where(
                and(
                    eq(caseStages.caseId, caseId),
                    inArray(stageOptions.id, selectedOptionIds)
                )
            );

        if (optionRows.length !== selectedOptionIds.length) {
            return { success: false, message: 'Invalid options for this case' };
        }

        const score = optionRows.reduce((sum, row) => sum + (row.scoreWeight || 0), 0);

        // Insert the attempt
        await db.insert(studentAttempts).values({
            userId,
            caseId,
            score,
        });

        // Update or create user stats
        const existingStats = await db.query.userStats.findFirst({
            where: eq(userStats.userId, userId),
        });

        if (existingStats) {
            // Update existing stats
            const newTotalAttempts = existingStats.totalAttempts + 1;
            const newTotalScore = existingStats.totalScore + score;
            const newAverageScore = Math.round(newTotalScore / newTotalAttempts);

            await db
                .update(userStats)
                .set({
                    totalAttempts: newTotalAttempts,
                    totalScore: newTotalScore,
                    averageScore: newAverageScore,
                    lastActivityAt: new Date(),
                })
                .where(eq(userStats.userId, userId));
        } else {
            // Create new stats
            await db.insert(userStats).values({
                userId,
                totalAttempts: 1,
                totalScore: score,
                averageScore: score,
                lastActivityAt: new Date(),
            });
        }

        // Update or create category stats
        const existingCategoryStats = await db.query.categoryStats.findFirst({
            where: and(
                eq(categoryStats.userId, userId),
                eq(categoryStats.clinicalDomain, caseData.clinicalDomain)
            ),
        });

        if (existingCategoryStats) {
            const newTotalAttempts = existingCategoryStats.totalAttempts + 1;
            const newTotalScore = existingCategoryStats.totalScore + score;
            const newAverageScore = Math.round(newTotalScore / newTotalAttempts);

            await db
                .update(categoryStats)
                .set({
                    totalAttempts: newTotalAttempts,
                    totalScore: newTotalScore,
                    averageScore: newAverageScore,
                    lastAttemptAt: new Date(),
                })
                .where(
                    and(
                        eq(categoryStats.userId, userId),
                        eq(categoryStats.clinicalDomain, caseData.clinicalDomain)
                    )
                );
        } else {
            await db.insert(categoryStats).values({
                userId,
                clinicalDomain: caseData.clinicalDomain,
                totalAttempts: 1,
                totalScore: score,
                averageScore: score,
                lastAttemptAt: new Date(),
            });
        }

        // Update or create difficulty stats
        const existingDifficultyStats = await db.query.difficultyStats.findFirst({
            where: and(
                eq(difficultyStats.userId, userId),
                eq(difficultyStats.difficultyLevel, caseData.difficultyLevel)
            ),
        });

        if (existingDifficultyStats) {
            const newTotalAttempts = existingDifficultyStats.totalAttempts + 1;
            const newTotalScore = existingDifficultyStats.totalScore + score;
            const newAverageScore = Math.round(newTotalScore / newTotalAttempts);

            await db
                .update(difficultyStats)
                .set({
                    totalAttempts: newTotalAttempts,
                    totalScore: newTotalScore,
                    averageScore: newAverageScore,
                    lastAttemptAt: new Date(),
                })
                .where(
                    and(
                        eq(difficultyStats.userId, userId),
                        eq(difficultyStats.difficultyLevel, caseData.difficultyLevel)
                    )
                );
        } else {
            await db.insert(difficultyStats).values({
                userId,
                difficultyLevel: caseData.difficultyLevel,
                totalAttempts: 1,
                totalScore: score,
                averageScore: score,
                lastAttemptAt: new Date(),
            });
        }

        // Update or create spaced repetition card using SM-2 algorithm
        const existingCard = await db.query.spacedRepetitionCards.findFirst({
            where: and(
                eq(spacedRepetitionCards.userId, userId),
                eq(spacedRepetitionCards.caseId, caseId)
            ),
        });

        // Calculate quality (0-5 scale) from score
        // Assuming scores can range widely, normalize to 0-5
        // For simplicity: score > 20 = 5 (perfect), score > 10 = 4, score > 0 = 3, score > -10 = 2, score > -20 = 1, else 0
        let quality = 0;
        if (score > 20) quality = 5;
        else if (score > 10) quality = 4;
        else if (score > 0) quality = 3;
        else if (score > -10) quality = 2;
        else if (score > -20) quality = 1;

        let nextReviewDate: Date;
        let reviewInterval: number;

        if (existingCard) {
            // Update using SM-2 algorithm
            let newEaseFactor = existingCard.easeFactor;
            let newInterval = existingCard.interval;
            let newRepetitions = existingCard.repetitions;

            if (quality >= 3) {
                // Successful review
                newRepetitions += 1;

                if (newRepetitions === 1) {
                    newInterval = 1;
                } else if (newRepetitions === 2) {
                    newInterval = 6;
                } else {
                    newInterval = Math.round(newInterval * (newEaseFactor / 1000));
                }

                // Update ease factor
                newEaseFactor = Math.max(
                    1300,
                    newEaseFactor + (100 * (3.6 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
                );
            } else {
                // Failed review - reset
                newRepetitions = 0;
                newInterval = 1;
            }

            nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
            reviewInterval = newInterval;

            await db
                .update(spacedRepetitionCards)
                .set({
                    repetitions: newRepetitions,
                    easeFactor: Math.round(newEaseFactor),
                    interval: newInterval,
                    nextReviewDate,
                    lastReviewedAt: new Date(),
                })
                .where(eq(spacedRepetitionCards.id, existingCard.id));
        } else {
            // Create new card
            nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + 1); // Review tomorrow
            reviewInterval = 1;

            await db.insert(spacedRepetitionCards).values({
                userId,
                caseId,
                repetitions: 0,
                easeFactor: 2500, // Default 2.5
                interval: 1,
                nextReviewDate,
                lastReviewedAt: new Date(),
            });
        }

        revalidatePath('/leaderboard');
        revalidatePath('/performance');
        revalidatePath('/review');

        return {
            success: true,
            message: 'Attempt recorded successfully',
            score,
            nextReviewDate,
            reviewInterval
        };
    } catch (error) {
        console.error('Error recording attempt:', error);
        return { success: false, message: 'Failed to record attempt' };
    }
}

function rankEntries<T extends { totalScore: number }>(entries: T[]) {
    return entries
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function getStudentDirectory() {
    const rows = await db.query.users.findMany({
        where: eq(users.role, 'student'),
        columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
        },
    });

    return new Map(rows.map((row) => [row.id, row]));
}

export async function getLeaderboard(
    limit: number = 100,
    category?: string,
    difficulty?: string,
    mode: AnalyticsMode = 'all'
) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    try {
        const normalizedDifficulty = difficultyLevels.find((level) => level === difficulty);

        if (mode === 'cases') {
            let rows;
            if (category) {
                rows = await db
                    .select({
                        userId: categoryStats.userId,
                        email: users.email,
                        totalAttempts: categoryStats.totalAttempts,
                        totalScore: categoryStats.totalScore,
                        averageScore: categoryStats.averageScore,
                        lastActivityAt: categoryStats.lastAttemptAt,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        imageUrl: users.imageUrl,
                    })
                    .from(categoryStats)
                    .innerJoin(users, eq(categoryStats.userId, users.id))
                    .where(and(eq(users.role, 'student'), eq(categoryStats.clinicalDomain, category)))
                    .orderBy(desc(categoryStats.totalScore))
                    .limit(limit);
            } else if (normalizedDifficulty) {
                rows = await db
                    .select({
                        userId: difficultyStats.userId,
                        email: users.email,
                        totalAttempts: difficultyStats.totalAttempts,
                        totalScore: difficultyStats.totalScore,
                        averageScore: difficultyStats.averageScore,
                        lastActivityAt: difficultyStats.lastAttemptAt,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        imageUrl: users.imageUrl,
                    })
                    .from(difficultyStats)
                    .innerJoin(users, eq(difficultyStats.userId, users.id))
                    .where(and(eq(users.role, 'student'), eq(difficultyStats.difficultyLevel, normalizedDifficulty)))
                    .orderBy(desc(difficultyStats.totalScore))
                    .limit(limit);
            } else {
                rows = await db
                    .select({
                        userId: userStats.userId,
                        email: users.email,
                        totalAttempts: userStats.totalAttempts,
                        totalScore: userStats.totalScore,
                        averageScore: userStats.averageScore,
                        lastActivityAt: userStats.lastActivityAt,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        imageUrl: users.imageUrl,
                    })
                    .from(userStats)
                    .innerJoin(users, eq(userStats.userId, users.id))
                    .where(eq(users.role, 'student'))
                    .orderBy(desc(userStats.totalScore))
                    .limit(limit);
            }

            return {
                success: true,
                data: rows.map((entry, index) => ({
                    ...entry,
                    rank: index + 1,
                    user: {
                        firstName: entry.firstName,
                        lastName: entry.lastName,
                        imageUrl: entry.imageUrl,
                    },
                })),
            };
        }

        if (mode === 'ukmla') {
            let rows;
            if (category) {
                rows = await db
                    .select({
                        userId: ukmlaCategoryStats.userId,
                        email: users.email,
                        totalAttempts: ukmlaCategoryStats.totalAttempts,
                        totalScore: ukmlaCategoryStats.totalScore,
                        averageScore: ukmlaCategoryStats.averageScore,
                        lastActivityAt: ukmlaCategoryStats.lastAttemptAt,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        imageUrl: users.imageUrl,
                    })
                    .from(ukmlaCategoryStats)
                    .innerJoin(users, eq(ukmlaCategoryStats.userId, users.id))
                    .where(and(eq(users.role, 'student'), eq(ukmlaCategoryStats.category, category as never)))
                    .orderBy(desc(ukmlaCategoryStats.totalScore))
                    .limit(limit);
            } else if (normalizedDifficulty) {
                rows = await db
                    .select({
                        userId: ukmlaDifficultyStats.userId,
                        email: users.email,
                        totalAttempts: ukmlaDifficultyStats.totalAttempts,
                        totalScore: ukmlaDifficultyStats.totalScore,
                        averageScore: ukmlaDifficultyStats.averageScore,
                        lastActivityAt: ukmlaDifficultyStats.lastAttemptAt,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        imageUrl: users.imageUrl,
                    })
                    .from(ukmlaDifficultyStats)
                    .innerJoin(users, eq(ukmlaDifficultyStats.userId, users.id))
                    .where(and(eq(users.role, 'student'), eq(ukmlaDifficultyStats.difficultyLevel, normalizedDifficulty)))
                    .orderBy(desc(ukmlaDifficultyStats.totalScore))
                    .limit(limit);
            } else {
                rows = await db
                    .select({
                        userId: ukmlaUserStats.userId,
                        email: users.email,
                        totalAttempts: ukmlaUserStats.totalAttempts,
                        totalScore: ukmlaUserStats.totalScore,
                        averageScore: ukmlaUserStats.averageScore,
                        lastActivityAt: ukmlaUserStats.lastActivityAt,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        imageUrl: users.imageUrl,
                    })
                    .from(ukmlaUserStats)
                    .innerJoin(users, eq(ukmlaUserStats.userId, users.id))
                    .where(eq(users.role, 'student'))
                    .orderBy(desc(ukmlaUserStats.totalScore))
                    .limit(limit);
            }

            return {
                success: true,
                data: rows.map((entry, index) => ({
                    ...entry,
                    rank: index + 1,
                    user: {
                        firstName: entry.firstName,
                        lastName: entry.lastName,
                        imageUrl: entry.imageUrl,
                    },
                })),
            };
        }

        const studentsMap = await getStudentDirectory();
        const aggregate = new Map<
            string,
            {
                userId: string;
                totalAttempts: number;
                totalScore: number;
                weightedAverage: number;
                weightedAttempts: number;
                lastActivityAt: Date;
            }
        >();

        if (category) {
            const [caseRows, ukmlaRows] = await Promise.all([
                db.query.categoryStats.findMany({ where: eq(categoryStats.clinicalDomain, category) }),
                db.query.ukmlaCategoryStats.findMany({ where: eq(ukmlaCategoryStats.category, category as never) }),
            ]);

            for (const row of caseRows) {
                const current = aggregate.get(row.userId) || {
                    userId: row.userId,
                    totalAttempts: 0,
                    totalScore: 0,
                    weightedAverage: 0,
                    weightedAttempts: 0,
                    lastActivityAt: row.lastAttemptAt,
                };
                current.totalAttempts += row.totalAttempts;
                current.totalScore += row.totalScore;
                current.weightedAverage += row.averageScore * row.totalAttempts;
                current.weightedAttempts += row.totalAttempts;
                current.lastActivityAt =
                    new Date(current.lastActivityAt) > new Date(row.lastAttemptAt) ? current.lastActivityAt : row.lastAttemptAt;
                aggregate.set(row.userId, current);
            }

            for (const row of ukmlaRows) {
                const current = aggregate.get(row.userId) || {
                    userId: row.userId,
                    totalAttempts: 0,
                    totalScore: 0,
                    weightedAverage: 0,
                    weightedAttempts: 0,
                    lastActivityAt: row.lastAttemptAt,
                };
                current.totalAttempts += row.totalAttempts;
                current.totalScore += row.totalScore;
                current.weightedAverage += row.averageScore * row.totalAttempts;
                current.weightedAttempts += row.totalAttempts;
                current.lastActivityAt =
                    new Date(current.lastActivityAt) > new Date(row.lastAttemptAt) ? current.lastActivityAt : row.lastAttemptAt;
                aggregate.set(row.userId, current);
            }
        } else if (normalizedDifficulty) {
            const [caseRows, ukmlaRows] = await Promise.all([
                db.query.difficultyStats.findMany({
                    where: eq(difficultyStats.difficultyLevel, normalizedDifficulty),
                }),
                db.query.ukmlaDifficultyStats.findMany({
                    where: eq(ukmlaDifficultyStats.difficultyLevel, normalizedDifficulty),
                }),
            ]);

            for (const row of caseRows) {
                const current = aggregate.get(row.userId) || {
                    userId: row.userId,
                    totalAttempts: 0,
                    totalScore: 0,
                    weightedAverage: 0,
                    weightedAttempts: 0,
                    lastActivityAt: row.lastAttemptAt,
                };
                current.totalAttempts += row.totalAttempts;
                current.totalScore += row.totalScore;
                current.weightedAverage += row.averageScore * row.totalAttempts;
                current.weightedAttempts += row.totalAttempts;
                current.lastActivityAt =
                    new Date(current.lastActivityAt) > new Date(row.lastAttemptAt) ? current.lastActivityAt : row.lastAttemptAt;
                aggregate.set(row.userId, current);
            }

            for (const row of ukmlaRows) {
                const current = aggregate.get(row.userId) || {
                    userId: row.userId,
                    totalAttempts: 0,
                    totalScore: 0,
                    weightedAverage: 0,
                    weightedAttempts: 0,
                    lastActivityAt: row.lastAttemptAt,
                };
                current.totalAttempts += row.totalAttempts;
                current.totalScore += row.totalScore;
                current.weightedAverage += row.averageScore * row.totalAttempts;
                current.weightedAttempts += row.totalAttempts;
                current.lastActivityAt =
                    new Date(current.lastActivityAt) > new Date(row.lastAttemptAt) ? current.lastActivityAt : row.lastAttemptAt;
                aggregate.set(row.userId, current);
            }
        } else {
            const [caseRows, ukmlaRows] = await Promise.all([
                db.query.userStats.findMany(),
                db.query.ukmlaUserStats.findMany(),
            ]);

            for (const row of caseRows) {
                const current = aggregate.get(row.userId) || {
                    userId: row.userId,
                    totalAttempts: 0,
                    totalScore: 0,
                    weightedAverage: 0,
                    weightedAttempts: 0,
                    lastActivityAt: row.lastActivityAt,
                };
                current.totalAttempts += row.totalAttempts;
                current.totalScore += row.totalScore;
                current.weightedAverage += row.averageScore * row.totalAttempts;
                current.weightedAttempts += row.totalAttempts;
                current.lastActivityAt =
                    new Date(current.lastActivityAt) > new Date(row.lastActivityAt) ? current.lastActivityAt : row.lastActivityAt;
                aggregate.set(row.userId, current);
            }

            for (const row of ukmlaRows) {
                const current = aggregate.get(row.userId) || {
                    userId: row.userId,
                    totalAttempts: 0,
                    totalScore: 0,
                    weightedAverage: 0,
                    weightedAttempts: 0,
                    lastActivityAt: row.lastActivityAt,
                };
                current.totalAttempts += row.totalAttempts;
                current.totalScore += row.totalScore;
                current.weightedAverage += row.averageScore * row.totalAttempts;
                current.weightedAttempts += row.totalAttempts;
                current.lastActivityAt =
                    new Date(current.lastActivityAt) > new Date(row.lastActivityAt) ? current.lastActivityAt : row.lastActivityAt;
                aggregate.set(row.userId, current);
            }
        }

        const merged = Array.from(aggregate.values())
            .filter((row) => studentsMap.has(row.userId))
            .map((row) => {
                const user = studentsMap.get(row.userId)!;
                return {
                    userId: row.userId,
                    email: user.email,
                    totalAttempts: row.totalAttempts,
                    totalScore: row.totalScore,
                    averageScore: row.weightedAttempts > 0 ? Math.round(row.weightedAverage / row.weightedAttempts) : 0,
                    lastActivityAt: row.lastActivityAt,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    imageUrl: user.imageUrl,
                };
            });

        const ranked = rankEntries(merged).slice(0, limit);

        return {
            success: true,
            data: ranked.map((entry) => ({
                ...entry,
                user: {
                    firstName: entry.firstName,
                    lastName: entry.lastName,
                    imageUrl: entry.imageUrl,
                },
            })),
        };
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return { success: false, data: [], message: 'Failed to fetch leaderboard' };
    }
}

export async function getStudentStats(targetUserId?: string, mode: AnalyticsMode = 'all') {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const lookupUserId = targetUserId || userId;

    try {
        const [caseStat, ukmlaStat, caseAll, ukmlaAll] = await Promise.all([
            db.query.userStats.findFirst({ where: eq(userStats.userId, lookupUserId) }),
            db.query.ukmlaUserStats.findFirst({ where: eq(ukmlaUserStats.userId, lookupUserId) }),
            db.query.userStats.findMany(),
            db.query.ukmlaUserStats.findMany(),
        ]);

        const caseTotal = caseStat || { totalAttempts: 0, totalScore: 0, averageScore: 0 };
        const ukmlaTotal = ukmlaStat || { totalAttempts: 0, totalScore: 0, averageScore: 0 };

        let totalAttempts = 0;
        let totalScore = 0;
        let averageScore = 0;
        let rankedPool: { userId: string; totalScore: number }[] = [];

        if (mode === 'cases') {
            totalAttempts = caseTotal.totalAttempts;
            totalScore = caseTotal.totalScore;
            averageScore = caseTotal.averageScore;
            rankedPool = caseAll.map((row) => ({ userId: row.userId, totalScore: row.totalScore }));
        } else if (mode === 'ukmla') {
            totalAttempts = ukmlaTotal.totalAttempts;
            totalScore = ukmlaTotal.totalScore;
            averageScore = ukmlaTotal.averageScore;
            rankedPool = ukmlaAll.map((row) => ({ userId: row.userId, totalScore: row.totalScore }));
        } else {
            totalAttempts = caseTotal.totalAttempts + ukmlaTotal.totalAttempts;
            totalScore = caseTotal.totalScore + ukmlaTotal.totalScore;
            averageScore =
                totalAttempts > 0
                    ? Math.round(
                        (caseTotal.averageScore * caseTotal.totalAttempts + ukmlaTotal.averageScore * ukmlaTotal.totalAttempts) /
                        totalAttempts
                    )
                    : 0;

            const map = new Map<string, number>();
            for (const row of caseAll) {
                map.set(row.userId, (map.get(row.userId) || 0) + row.totalScore);
            }
            for (const row of ukmlaAll) {
                map.set(row.userId, (map.get(row.userId) || 0) + row.totalScore);
            }
            rankedPool = Array.from(map.entries()).map(([id, score]) => ({ userId: id, totalScore: score }));
        }

        const rank = rankEntries(rankedPool).find((entry) => entry.userId === lookupUserId)?.rank || null;

        return {
            success: true,
            data: {
                totalAttempts,
                totalScore,
                averageScore,
                rank,
            },
        };
    } catch (error) {
        console.error('Error fetching student stats:', error);
        return { success: false, message: 'Failed to fetch student stats' };
    }
}

export async function getRecentAttempts(limit: number = 10, mode: AnalyticsMode = 'cases') {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    try {
        const casePromise = mode === 'ukmla'
            ? Promise.resolve([])
            : db.query.studentAttempts.findMany({
                where: eq(studentAttempts.userId, userId),
                orderBy: desc(studentAttempts.completedAt),
                limit,
                with: {
                    case: {
                        columns: {
                            id: true,
                            title: true,
                            clinicalDomain: true,
                            difficultyLevel: true,
                        },
                    },
                },
            });

        const ukmlaPromise = mode === 'cases'
            ? Promise.resolve([])
            : db.query.ukmlaAttempts.findMany({
                where: eq(ukmlaAttempts.userId, userId),
                orderBy: desc(ukmlaAttempts.completedAt),
                limit,
                with: {
                    question: {
                        columns: {
                            id: true,
                            stem: true,
                            category: true,
                            difficultyLevel: true,
                        },
                    },
                },
            });

        const [caseAttempts, ukmlaAttemptsRows] = await Promise.all([casePromise, ukmlaPromise]);

        const normalizedCases = caseAttempts.map((attempt) => ({
            id: attempt.id,
            score: attempt.score,
            completedAt: attempt.completedAt,
            type: 'case' as const,
            case: attempt.case,
        }));

        const normalizedUkmla = ukmlaAttemptsRows.map((attempt) => ({
            id: attempt.id,
            score: attempt.score,
            completedAt: attempt.completedAt,
            type: 'ukmla' as const,
            case: {
                id: attempt.question.id,
                title: attempt.question.stem,
                clinicalDomain: attempt.question.category,
                difficultyLevel: attempt.question.difficultyLevel,
            },
        }));

        const combined = [...normalizedCases, ...normalizedUkmla]
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            .slice(0, limit);

        return { success: true, data: combined };
    } catch (error) {
        console.error('Error fetching recent attempts:', error);
        return { success: false, data: [], message: 'Failed to fetch recent attempts' };
    }
}

export async function getCategoryStats(targetUserId?: string, mode: AnalyticsMode = 'all') {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    const lookupUserId = targetUserId || userId;

    try {
        if (mode === 'cases') {
            const stats = await db.query.categoryStats.findMany({
                where: eq(categoryStats.userId, lookupUserId),
            });
            return { success: true, data: stats };
        }

        if (mode === 'ukmla') {
            const stats = await db.query.ukmlaCategoryStats.findMany({
                where: eq(ukmlaCategoryStats.userId, lookupUserId),
            });
            return {
                success: true,
                data: stats.map((row) => ({
                    ...row,
                    clinicalDomain: row.category,
                })),
            };
        }

        const [caseRows, ukmlaRows] = await Promise.all([
            db.query.categoryStats.findMany({ where: eq(categoryStats.userId, lookupUserId) }),
            db.query.ukmlaCategoryStats.findMany({ where: eq(ukmlaCategoryStats.userId, lookupUserId) }),
        ]);

        const map = new Map<
            string,
            {
                clinicalDomain: string;
                totalAttempts: number;
                totalScore: number;
                weightedAverage: number;
            }
        >();

        for (const row of caseRows) {
            const current = map.get(row.clinicalDomain) || {
                clinicalDomain: row.clinicalDomain,
                totalAttempts: 0,
                totalScore: 0,
                weightedAverage: 0,
            };
            current.totalAttempts += row.totalAttempts;
            current.totalScore += row.totalScore;
            current.weightedAverage += row.averageScore * row.totalAttempts;
            map.set(row.clinicalDomain, current);
        }

        for (const row of ukmlaRows) {
            const current = map.get(row.category) || {
                clinicalDomain: row.category,
                totalAttempts: 0,
                totalScore: 0,
                weightedAverage: 0,
            };
            current.totalAttempts += row.totalAttempts;
            current.totalScore += row.totalScore;
            current.weightedAverage += row.averageScore * row.totalAttempts;
            map.set(row.category, current);
        }

        return {
            success: true,
            data: Array.from(map.values()).map((entry) => ({
                clinicalDomain: entry.clinicalDomain,
                totalAttempts: entry.totalAttempts,
                totalScore: entry.totalScore,
                averageScore: entry.totalAttempts > 0 ? Math.round(entry.weightedAverage / entry.totalAttempts) : 0,
            })),
        };
    } catch (error) {
        console.error('Error fetching category stats:', error);
        return { success: false, data: [], message: 'Failed to fetch category stats' };
    }
}

export async function getDifficultyStats(targetUserId?: string, mode: AnalyticsMode = 'all') {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    const lookupUserId = targetUserId || userId;

    try {
        if (mode === 'cases') {
            const stats = await db.query.difficultyStats.findMany({
                where: eq(difficultyStats.userId, lookupUserId),
            });
            return { success: true, data: stats };
        }

        if (mode === 'ukmla') {
            const stats = await db.query.ukmlaDifficultyStats.findMany({
                where: eq(ukmlaDifficultyStats.userId, lookupUserId),
            });
            return { success: true, data: stats };
        }

        const [caseRows, ukmlaRows] = await Promise.all([
            db.query.difficultyStats.findMany({ where: eq(difficultyStats.userId, lookupUserId) }),
            db.query.ukmlaDifficultyStats.findMany({ where: eq(ukmlaDifficultyStats.userId, lookupUserId) }),
        ]);

        const map = new Map<string, { difficultyLevel: string; totalAttempts: number; totalScore: number; weightedAverage: number }>();

        for (const row of caseRows) {
            const current = map.get(row.difficultyLevel) || {
                difficultyLevel: row.difficultyLevel,
                totalAttempts: 0,
                totalScore: 0,
                weightedAverage: 0,
            };
            current.totalAttempts += row.totalAttempts;
            current.totalScore += row.totalScore;
            current.weightedAverage += row.averageScore * row.totalAttempts;
            map.set(row.difficultyLevel, current);
        }

        for (const row of ukmlaRows) {
            const current = map.get(row.difficultyLevel) || {
                difficultyLevel: row.difficultyLevel,
                totalAttempts: 0,
                totalScore: 0,
                weightedAverage: 0,
            };
            current.totalAttempts += row.totalAttempts;
            current.totalScore += row.totalScore;
            current.weightedAverage += row.averageScore * row.totalAttempts;
            map.set(row.difficultyLevel, current);
        }

        return {
            success: true,
            data: Array.from(map.values()).map((entry) => ({
                difficultyLevel: entry.difficultyLevel,
                totalAttempts: entry.totalAttempts,
                totalScore: entry.totalScore,
                averageScore: entry.totalAttempts > 0 ? Math.round(entry.weightedAverage / entry.totalAttempts) : 0,
            })),
        };
    } catch (error) {
        console.error('Error fetching difficulty stats:', error);
        return { success: false, data: [], message: 'Failed to fetch difficulty stats' };
    }
}

export async function getPercentileRank(targetUserId?: string, mode: AnalyticsMode = 'all') {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const lookupUserId = targetUserId || userId;

    try {
        let entries: { userId: string; totalScore: number }[] = [];

        if (mode === 'cases') {
            const rows = await db.query.userStats.findMany();
            entries = rows.map((row) => ({ userId: row.userId, totalScore: row.totalScore }));
        } else if (mode === 'ukmla') {
            const rows = await db.query.ukmlaUserStats.findMany();
            entries = rows.map((row) => ({ userId: row.userId, totalScore: row.totalScore }));
        } else {
            const [caseRows, ukmlaRows] = await Promise.all([
                db.query.userStats.findMany(),
                db.query.ukmlaUserStats.findMany(),
            ]);
            const map = new Map<string, number>();
            for (const row of caseRows) {
                map.set(row.userId, (map.get(row.userId) || 0) + row.totalScore);
            }
            for (const row of ukmlaRows) {
                map.set(row.userId, (map.get(row.userId) || 0) + row.totalScore);
            }
            entries = Array.from(map.entries()).map(([id, score]) => ({ userId: id, totalScore: score }));
        }

        const ranked = rankEntries(entries);
        const target = ranked.find((entry) => entry.userId === lookupUserId);
        if (!target) {
            return {
                success: true,
                data: { percentile: 0, rank: null, totalUsers: ranked.length },
            };
        }

        const lowerOrEqual = ranked.filter((entry) => entry.totalScore <= target.totalScore).length;
        const percentile = ranked.length > 0 ? Math.round((lowerOrEqual / ranked.length) * 100) : 0;

        return {
            success: true,
            data: {
                percentile,
                rank: target.rank,
                totalUsers: ranked.length,
            },
        };
    } catch (error) {
        console.error('Error calculating percentile rank:', error);
        return { success: false, message: 'Failed to calculate percentile rank' };
    }
}

/**
 * Get cases due for review (spaced repetition)
 */
export async function getReviewQueue(limit: number = 50) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    try {
        const now = new Date();

        const reviewCards = await db.query.spacedRepetitionCards.findMany({
            where: and(
                eq(spacedRepetitionCards.userId, userId),
                lte(spacedRepetitionCards.nextReviewDate, now)
            ),
            orderBy: [desc(spacedRepetitionCards.nextReviewDate)],
            limit,
            with: {
                case: {
                    columns: {
                        id: true,
                        title: true,
                        description: true,
                        clinicalDomain: true,
                        difficultyLevel: true,
                    },
                },
            },
        });

        return { success: true, data: reviewCards };
    } catch (error) {
        console.error('Error fetching review queue:', error);
        return { success: false, data: [], message: 'Failed to fetch review queue' };
    }
}

/**
 * Get count of cards due for review
 */
export async function getDueReviewCount() {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized', count: 0 };
    }

    try {
        const now = new Date();

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(spacedRepetitionCards)
            .where(
                and(
                    eq(spacedRepetitionCards.userId, userId),
                    lte(spacedRepetitionCards.nextReviewDate, now)
                )
            );

        const count = Number(countResult[0]?.count || 0);

        return { success: true, count };
    } catch (error) {
        console.error('Error fetching due review count:', error);
        return { success: false, count: 0, message: 'Failed to fetch due review count' };
    }
}
