'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { studentAttempts, userStats, users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Record a student's completion of a case simulation
 */
export async function recordAttempt(caseId: number, score: number) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    try {
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

        revalidatePath('/leaderboard');

        return {
            success: true,
            message: 'Attempt recorded successfully',
            score,
        };
    } catch (error) {
        console.error('Error recording attempt:', error);
        return { success: false, message: 'Failed to record attempt' };
    }
}

/**
 * Get leaderboard data with top students
 */
export async function getLeaderboard(limit: number = 100) {
    try {
        const leaderboardData = await db
            .select({
                userId: userStats.userId,
                email: users.email,
                totalAttempts: userStats.totalAttempts,
                totalScore: userStats.totalScore,
                averageScore: userStats.averageScore,
                lastActivityAt: userStats.lastActivityAt,
            })
            .from(userStats)
            .innerJoin(users, eq(userStats.userId, users.id))
            .where(eq(users.role, 'student')) // Only show students
            .orderBy(desc(userStats.totalScore))
            .limit(limit);

        // Add rank to each entry
        const rankedData = leaderboardData.map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));

        return { success: true, data: rankedData };
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
