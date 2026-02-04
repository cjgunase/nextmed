'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryStats, DifficultyStats } from '@/db/schema';

interface PerformanceChartsProps {
    categoryStats: CategoryStats[];
    difficultyStats: DifficultyStats[];
}

export function PerformanceCharts({ categoryStats, difficultyStats }: PerformanceChartsProps) {
    // Process category stats for charts
    const categoryData = categoryStats.map(stat => ({
        subject: stat.clinicalDomain,
        score: stat.averageScore,
        attempts: stat.totalAttempts,
        fullMark: 100,
    }));

    // Process difficulty stats for charts
    const difficultyData = difficultyStats.map(stat => ({
        name: stat.difficultyLevel,
        score: stat.averageScore,
        attempts: stat.totalAttempts,
    }));

    // Sort difficulty data by level: Foundation -> Core -> Advanced
    const difficultyOrder = { 'Foundation': 1, 'Core': 2, 'Advanced': 3 };
    difficultyData.sort((a, b) => {
        return (difficultyOrder[a.name as keyof typeof difficultyOrder] || 0) -
            (difficultyOrder[b.name as keyof typeof difficultyOrder] || 0);
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Category Performance Radar Chart */}
            <Card className="col-span-1 shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                    <CardTitle className="text-xl text-primary">Performance by Category</CardTitle>
                    <CardDescription>Your average score across different clinical domains</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryData}>
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                    <Radar
                                        name="Average Score"
                                        dataKey="score"
                                        stroke="#2563eb"
                                        fill="#3b82f6"
                                        fillOpacity={0.5}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                No category data available yet
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Difficulty Performance Bar Chart */}
            <Card className="col-span-1 shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                    <CardTitle className="text-xl text-primary">Performance by Difficulty</CardTitle>
                    <CardDescription>How you handle different complexity levels</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        {difficultyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={difficultyData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f3f4f6' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="score" name="Average Score" radius={[0, 4, 4, 0]} barSize={32}>
                                        {difficultyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.score >= 70 ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                No difficulty data available yet
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
