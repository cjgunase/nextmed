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
    spacedRepetitionCards
} from '@/db/schema';
import { eq, desc, sql, and, lte, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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

/**
 * Get leaderboard data with top students
 */
/**
 * Get leaderboard data with top students
 */
export async function getLeaderboard(limit: number = 100, category?: string, difficulty?: string) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    try {
        let leaderboardData;

        if (category) {
            leaderboardData = await db
                .select({
                    userId: categoryStats.userId,
                    email: users.email,
                    totalAttempts: categoryStats.totalAttempts,
                    totalScore: categoryStats.totalScore,
                    averageScore: categoryStats.averageScore,
                    lastActivityAt: categoryStats.lastAttemptAt,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    imageUrl: users.imageUrl
                })
                .from(categoryStats)
                .innerJoin(users, eq(categoryStats.userId, users.id))
                .where(and(
                    eq(users.role, 'student'),
                    eq(categoryStats.clinicalDomain, category)
                ))
                .orderBy(desc(categoryStats.totalScore))
                .limit(limit);
        } else if (difficulty) {
            leaderboardData = await db
                .select({
                    userId: difficultyStats.userId,
                    email: users.email,
                    totalAttempts: difficultyStats.totalAttempts,
                    totalScore: difficultyStats.totalScore,
                    averageScore: difficultyStats.averageScore,
                    lastActivityAt: difficultyStats.lastAttemptAt,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    imageUrl: users.imageUrl
                })
                .from(difficultyStats)
                .innerJoin(users, eq(difficultyStats.userId, users.id))
                .where(and(
                    eq(users.role, 'student'),
                    eq(difficultyStats.difficultyLevel, difficulty as any)
                ))
                .orderBy(desc(difficultyStats.totalScore))
                .limit(limit);
        } else {
            leaderboardData = await db
                .select({
                    userId: userStats.userId,
                    email: users.email,
                    totalAttempts: userStats.totalAttempts,
                    totalScore: userStats.totalScore,
                    averageScore: userStats.averageScore,
                    lastActivityAt: userStats.lastActivityAt,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    imageUrl: users.imageUrl
                })
                .from(userStats)
                .innerJoin(users, eq(userStats.userId, users.id))
                .where(eq(users.role, 'student'))
                .orderBy(desc(userStats.totalScore))
                .limit(limit);
        }

        const rankedData = leaderboardData.map((entry, index) => ({
            ...entry,
            rank: index + 1,
            user: {
                firstName: entry.firstName,
                lastName: entry.lastName,
                imageUrl: entry.imageUrl
            }
        }));

        return { success: true, data: rankedData };
        // End of function
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return { success: false, data: [], message: 'Failed to fetch leaderboard' };
    }
}

/**
 * Get statistics for a specific student
 */
export async function getStudentStats(targetUserId?: string) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    // Use provided userId or current user's userId
    const lookupUserId = targetUserId || userId;

    try {
        const stats = await db.query.userStats.findFirst({
            where: eq(userStats.userId, lookupUserId),
        });

        if (!stats) {
            return {
                success: true,
                data: {
                    totalAttempts: 0,
                    totalScore: 0,
                    averageScore: 0,
                    rank: null,
                },
            };
        }

        // Calculate rank
        const higherRankedCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(userStats)
            .where(sql`${userStats.totalScore} > ${stats.totalScore}`);

        const rank = Number(higherRankedCount[0]?.count || 0) + 1;

        return {
            success: true,
            data: {
                ...stats,
                rank,
            },
        };
    } catch (error) {
        console.error('Error fetching student stats:', error);
        return { success: false, message: 'Failed to fetch student stats' };
    }
}

/**
 * Get user's recent attempts
 */
export async function getRecentAttempts(limit: number = 10) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    try {
        const attempts = await db.query.studentAttempts.findMany({
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

        return { success: true, data: attempts };
    } catch (error) {
        console.error('Error fetching recent attempts:', error);
        return { success: false, data: [], message: 'Failed to fetch recent attempts' };
    }
}

/**
 * Get category performance stats for a user
 */
export async function getCategoryStats(targetUserId?: string) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    const lookupUserId = targetUserId || userId;

    try {
        const stats = await db.query.categoryStats.findMany({
            where: eq(categoryStats.userId, lookupUserId),
        });

        return { success: true, data: stats };
    } catch (error) {
        console.error('Error fetching category stats:', error);
        return { success: false, data: [], message: 'Failed to fetch category stats' };
    }
}

/**
 * Get difficulty level performance stats for a user
 */
export async function getDifficultyStats(targetUserId?: string) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized', data: [] };
    }

    const lookupUserId = targetUserId || userId;

    try {
        const stats = await db.query.difficultyStats.findMany({
            where: eq(difficultyStats.userId, lookupUserId),
        });

        return { success: true, data: stats };
    } catch (error) {
        console.error('Error fetching difficulty stats:', error);
        return { success: false, data: [], message: 'Failed to fetch difficulty stats' };
    }
}

/**
 * Calculate user's percentile rank among all students
 */
export async function getPercentileRank(targetUserId?: string) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const lookupUserId = targetUserId || userId;

    try {
        const userStat = await db.query.userStats.findFirst({
            where: eq(userStats.userId, lookupUserId),
        });

        if (!userStat) {
            return {
                success: true,
                data: {
                    percentile: 0,
                    rank: null,
                    totalUsers: 0,
                },
            };
        }

        // Count total students
        const totalStudentsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(userStats)
            .innerJoin(users, eq(userStats.userId, users.id))
            .where(eq(users.role, 'student'));

        const totalStudents = Number(totalStudentsResult[0]?.count || 0);

        // Count students with lower or equal scores
        const lowerRankedResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(userStats)
            .innerJoin(users, eq(userStats.userId, users.id))
            .where(
                and(
                    eq(users.role, 'student'),
                    sql`${userStats.totalScore} <= ${userStat.totalScore}`
                )
            );

        const lowerRanked = Number(lowerRankedResult[0]?.count || 0);

        // Calculate percentile (number of students with lower scores / total students) * 100
        const percentile = totalStudents > 0
            ? Math.round((lowerRanked / totalStudents) * 100)
            : 0;

        // Calculate rank
        const higherRankedResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(userStats)
            .where(sql`${userStats.totalScore} > ${userStat.totalScore}`);

        const rank = Number(higherRankedResult[0]?.count || 0) + 1;

        return {
            success: true,
            data: {
                percentile,
                rank,
                totalUsers: totalStudents,
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
