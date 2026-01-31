import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getLeaderboard, getStudentStats } from '@/actions/student';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Leaderboard Page - Server Component
 */
export default async function LeaderboardPage() {
    // 1. Authenticate user
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    // 2. Fetch leaderboard and user's own stats
    const [leaderboardResult, userStatsResult] = await Promise.all([
        getLeaderboard(100),
        getStudentStats(),
    ]);

    const leaderboard = leaderboardResult.success ? leaderboardResult.data : [];
    const userStats = userStatsResult.success ? userStatsResult.data : null;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground mt-2">
                    Top medical students ranked by total score
                </p>
            </div>

            {/* User's Stats Card */}
            {userStats && (
                <Card className="mb-8 border-primary/50 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg">Your Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-2xl font-bold text-primary">
                                    #{userStats.rank || '-'}
                                </div>
                                <div className="text-sm text-muted-foreground">Rank</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{userStats.totalScore}</div>
                                <div className="text-sm text-muted-foreground">Total Score</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{userStats.totalAttempts}</div>
                                <div className="text-sm text-muted-foreground">Cases Completed</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{userStats.averageScore}</div>
                                <div className="text-sm text-muted-foreground">Average Score</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Leaderboard Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Top Students</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <p className="text-muted-foreground mb-4">
                                No data yet. Be the first to complete a case!
                            </p>
                            <Link href="/cases">
                                <Button>Browse Cases</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b bg-muted/50">
                                    <tr>
                                        <th className="text-left p-4 font-semibold">Rank</th>
                                        <th className="text-left p-4 font-semibold">Student</th>
                                        <th className="text-right p-4 font-semibold">Total Score</th>
                                        <th className="text-right p-4 font-semibold">Cases</th>
                                        <th className="text-right p-4 font-semibold">Avg Score</th>
                                        <th className="text-right p-4 font-semibold hidden md:table-cell">
                                            Last Activity
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((entry, index) => (
                                        <tr
                                            key={entry.userId}
                                            className={`border-b hover:bg-muted/30 transition-colors ${entry.userId === userId ? 'bg-primary/10' : ''
                                                }`}
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {index < 3 && (
                                                        <span className="text-xl">
                                                            {index === 0
                                                                ? '🥇'
                                                                : index === 1
                                                                    ? '🥈'
                                                                    : '🥉'}
                                                        </span>
                                                    )}
                                                    <span className="font-semibold">#{entry.rank}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={
                                                            entry.userId === userId
                                                                ? 'font-semibold'
                                                                : ''
                                                        }
                                                    >
                                                        {entry.email}
                                                    </span>
                                                    {entry.userId === userId && (
                                                        <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-semibold text-lg">
                                                {entry.totalScore}
                                            </td>
                                            <td className="p-4 text-right">{entry.totalAttempts}</td>
                                            <td className="p-4 text-right">{entry.averageScore}</td>
                                            <td className="p-4 text-right text-sm text-muted-foreground hidden md:table-cell">
                                                {new Date(entry.lastActivityAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="mt-8 flex justify-center">
                <Link href="/cases">
                    <Button variant="outline">Back to Cases</Button>
                </Link>
            </div>
        </div>
    );
}
