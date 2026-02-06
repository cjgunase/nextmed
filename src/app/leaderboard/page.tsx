
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getLeaderboard, getStudentStats } from '@/actions/student';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ukmlaCategories } from '@/db/schema';

/**
 * Leaderboard Page - Server Component
 */
export default async function LeaderboardPage(props: { searchParams: Promise<{ category?: string; difficulty?: string; mode?: string }> }) {
    const searchParams = await props.searchParams;
    const { category, difficulty } = searchParams;
    const mode =
        typeof (searchParams as { mode?: string }).mode === 'string'
            ? (searchParams as { mode?: string }).mode
            : 'all';
    const normalizedMode = mode === 'cases' || mode === 'ukmla' ? mode : 'all';

    // 1. Authenticate user
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    // 2. Fetch leaderboard and user's own stats
    // Pass filters to getLeaderboard
    const [leaderboardResult, userStatsResult] = await Promise.all([
        getLeaderboard(100, category, difficulty, normalizedMode),
        getStudentStats(undefined, normalizedMode),
    ]);

    const leaderboard = leaderboardResult.success ? leaderboardResult.data : [];
    const userStats = userStatsResult.success ? userStatsResult.data : null;

    // Categories to filter by
    const caseCategories = ['Cardiology', 'Respiratory', 'Neurology', 'Gastroenterology', 'Musculoskeletal', 'Endocrinology'];
    const categories = normalizedMode === 'ukmla' ? ukmlaCategories : caseCategories;
    const difficultyLevels = ['Foundation', 'Core', 'Advanced'];

    const getTitle = () => {
        if (normalizedMode === 'cases') return 'Cases Leaderboard';
        if (normalizedMode === 'ukmla') return 'UKMLA Leaderboard';
        if (category) return `Top Students in ${category}`;
        if (difficulty) return `Top Students - ${difficulty} Level`;
        return 'Combined Leaderboard';
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{getTitle()}</h1>
                    <p className="text-muted-foreground mt-2">
                        Ranked by performance score
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/performance">
                        <Button variant="outline">View My Analytics</Button>
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-muted-foreground mr-2">Mode:</span>
                    <Link href="/leaderboard?mode=all">
                        <Badge variant={normalizedMode === 'all' ? 'default' : 'outline'} className="cursor-pointer">
                            All
                        </Badge>
                    </Link>
                    <Link href="/leaderboard?mode=cases">
                        <Badge variant={normalizedMode === 'cases' ? 'default' : 'outline'} className="cursor-pointer">
                            Cases
                        </Badge>
                    </Link>
                    <Link href="/leaderboard?mode=ukmla">
                        <Badge variant={normalizedMode === 'ukmla' ? 'default' : 'outline'} className="cursor-pointer">
                            UKMLA
                        </Badge>
                    </Link>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-muted-foreground mr-2">Category:</span>
                    <Link href={`/leaderboard?mode=${normalizedMode}`}>
                        <Badge variant={!category ? "default" : "outline"} className="cursor-pointer">
                            All
                        </Badge>
                    </Link>
                    {categories.map(cat => (
                        <Link key={cat} href={`/leaderboard?mode=${normalizedMode}&category=${cat}`}>
                            <Badge variant={category === cat ? "default" : "outline"} className="cursor-pointer">
                                {cat}
                            </Badge>
                        </Link>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-muted-foreground mr-2">Difficulty:</span>
                    {difficultyLevels.map(level => (
                        <Link key={level} href={`/leaderboard?mode=${normalizedMode}&difficulty=${level}`}>
                            <Badge variant={difficulty === level ? "default" : "outline"} className="cursor-pointer">
                                {level}
                            </Badge>
                        </Link>
                    ))}
                </div>
            </div>

            {/* User's Stats Card */}
            {userStats && !category && !difficulty && (
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
                                <div className="text-sm text-muted-foreground">Global Rank</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{userStats.totalScore}</div>
                                <div className="text-sm text-muted-foreground">Total XP</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{userStats.totalAttempts}</div>
                                <div className="text-sm text-muted-foreground">Cases Completed</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{userStats.averageScore}%</div>
                                <div className="text-sm text-muted-foreground">Average Score</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Leaderboard Table */}
            <Card>
                <CardContent className="p-0">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <p className="text-muted-foreground mb-4">
                                No data found for this filter.
                            </p>
                            <Link href="/cases">
                                <Button>Start Practice</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b bg-muted/50">
                                    <tr>
                                        <th className="text-left p-4 font-semibold w-20">Rank</th>
                                        <th className="text-left p-4 font-semibold">Student</th>
                                        <th className="text-right p-4 font-semibold">Score</th>
                                        <th className="text-right p-4 font-semibold">Cases</th>
                                        <th className="text-right p-4 font-semibold">Avg</th>
                                        <th className="text-right p-4 font-semibold hidden md:table-cell">
                                            Last Activity
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((entry, index) => (
                                        <tr
                                            key={entry.userId}
                                            className={`border-b hover:bg-muted/30 transition-colors ${entry.userId === userId ? 'bg-primary/5' : ''
                                                }`}
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {entry.rank <= 3 && (
                                                        <span className="text-xl">
                                                            {entry.rank === 1
                                                                ? '🥇'
                                                                : entry.rank === 2
                                                                    ? '🥈'
                                                                    : '🥉'}
                                                        </span>
                                                    )}
                                                    <span className="font-semibold text-muted-foreground">#{entry.rank}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-muted-foreground/20">
                                                        {entry.user?.imageUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={entry.user.imageUrl} alt="Avatar" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                {entry.user?.firstName?.charAt(0) || entry.email.charAt(0).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm ${entry.userId === userId ? 'font-bold' : 'font-medium'}`}>
                                                            {entry.user?.firstName ? `${entry.user.firstName} ${entry.user.lastName || ''}` : entry.email.split('@')[0]}
                                                            {entry.userId === userId && " (You)"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-primary">
                                                {entry.totalScore}
                                            </td>
                                            <td className="p-4 text-right">{entry.totalAttempts}</td>
                                            <td className="p-4 text-right font-medium">
                                                {entry.averageScore}%
                                            </td>
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
