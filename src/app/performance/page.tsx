import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
    getCategoryStats,
    getDifficultyStats,
    getStudentStats,
    getPercentileRank,
    getRecentAttempts
} from '@/actions/student';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PerformanceCharts } from '@/components/performance-chart';
import { ArrowRight, Trophy, Target, Activity, TrendingUp } from 'lucide-react';

export default async function PerformancePage(props: { searchParams: Promise<{ mode?: string }> }) {
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    const searchParams = await props.searchParams;
    const mode = searchParams.mode === 'cases' || searchParams.mode === 'ukmla' ? searchParams.mode : 'all';

    // Fetch all user statistics in parallel
    const [
        categoryStatsResult,
        difficultyStatsResult,
        userStatsResult,
        percentileResult,
        recentAttemptsResult
    ] = await Promise.all([
        getCategoryStats(undefined, mode),
        getDifficultyStats(undefined, mode),
        getStudentStats(undefined, mode),
        getPercentileRank(undefined, mode),
        getRecentAttempts(5, mode)
    ]);

    const categoryStats = categoryStatsResult.success ? categoryStatsResult.data : [];
    const difficultyStats = difficultyStatsResult.success ? difficultyStatsResult.data : [];
    const userStats = userStatsResult.success ? userStatsResult.data : null;
    const percentile = percentileResult.success ? percentileResult.data : { percentile: 0, rank: null, totalUsers: 0 };
    const safePercentile = {
        percentile: percentile?.percentile ?? 0,
        rank: percentile?.rank ?? null,
        totalUsers: percentile?.totalUsers ?? 0,
    };
    const recentAttempts = recentAttemptsResult.success ? recentAttemptsResult.data : [];

    // Identify weak areas (categories with score < 70)
    const weakAreas = categoryStats.filter(stat => stat.averageScore < 70).sort((a, b) => a.averageScore - b.averageScore);

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Performance Analytics</h1>
                    <p className="text-muted-foreground mt-1">
                        Track your progress, identify strengths, and improve your clinical skills ({mode.toUpperCase()})
                    </p>
                </div>
                <Link href={mode === 'ukmla' ? '/ukmla/review' : '/review'}>
                    <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                        <Activity className="mr-2 h-4 w-4" />
                        Practice Spaced Repetition
                    </Button>
                </Link>
            </div>

            <div className="flex flex-wrap gap-2">
                <Link href="/performance?mode=all">
                    <Button variant={mode === 'all' ? 'default' : 'outline'} size="sm">All</Button>
                </Link>
                <Link href="/performance?mode=cases">
                    <Button variant={mode === 'cases' ? 'default' : 'outline'} size="sm">Cases</Button>
                </Link>
                <Link href="/performance?mode=ukmla">
                    <Button variant={mode === 'ukmla' ? 'default' : 'outline'} size="sm">UKMLA</Button>
                </Link>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Global Rank</p>
                                <h3 className="text-2xl font-bold mt-1">Top {100 - safePercentile.percentile}%</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Rank #{safePercentile.rank} of {safePercentile.totalUsers} students
                                </p>
                            </div>
                            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950/50">
                                <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                                <h3 className="text-2xl font-bold mt-1">{userStats?.averageScore || 0}%</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Across {userStats?.totalAttempts || 0} total cases
                                </p>
                            </div>
                            <div className="rounded-full bg-green-100 p-2 dark:bg-green-950/50">
                                <Target className="h-5 w-5 text-green-600 dark:text-green-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total XP</p>
                                <h3 className="text-2xl font-bold mt-1">{userStats?.totalScore || 0}</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Cumulative performance points
                                </p>
                            </div>
                            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-950/50">
                                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
                                <h3 className="text-2xl font-bold mt-1">
                                    {recentAttempts.length > 0
                                        ? new Date(recentAttempts[0].completedAt).toLocaleDateString()
                                        : 'None'}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Last case completed
                                </p>
                            </div>
                            <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-950/50">
                                <Activity className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Charts */}
            <PerformanceCharts categoryStats={categoryStats} difficultyStats={difficultyStats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Weak Areas */}
                <Card className="lg:col-span-1 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="h-5 w-5 text-red-500" />
                            Focus Areas
                        </CardTitle>
                        <CardDescription>
                            Topics where you scored below 70%
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {weakAreas.length > 0 ? (
                            <div className="space-y-4">
                                {weakAreas.map((area) => (
                                    <div key={area.clinicalDomain} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium text-gray-700">{area.clinicalDomain}</span>
                                            <span className="text-red-500 font-bold">{area.averageScore}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className="bg-red-500 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${area.averageScore}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <Link href={mode === 'ukmla' ? `/ukmla?category=${area.clinicalDomain}` : `/cases?domain=${area.clinicalDomain}`}>
                                                <Button size="sm" variant="link" className="text-xs h-auto p-0 text-red-600">
                                                    Practice {area.clinicalDomain} <ArrowRight className="h-3 w-3 ml-1" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                <p className="mb-2">🎉 No weak areas found!</p>
                                <p>You&apos;re performing well across all categories attempted.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent History */}
                <Card className="lg:col-span-2 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Cases</CardTitle>
                        <CardDescription>
                            Your latest simulation attempts
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentAttempts.length > 0 ? (
                            <div className="space-y-4">
                                {recentAttempts.map((attempt) => (
                                    <div key={attempt.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3 transition-colors hover:bg-muted/70">
                                        <div>
                                            <p className="font-medium text-foreground">{attempt.case.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                                    {attempt.case.clinicalDomain}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(attempt.completedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-lg font-bold ${attempt.score >= 80 ? 'text-green-600' :
                                                attempt.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {attempt.score}
                                            </span>
                                            <p className="text-xs text-muted-foreground">Score</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No recent attempts found. Start a simulation to see your history!
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
