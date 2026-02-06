import { auth } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Sparkles, TrendingDown } from 'lucide-react';
import { db } from '@/db';
import {
    categoryStats,
    rivisionContextClusters,
    rivisionNoteTaxonomy,
    rivisionNotes,
    studentAttempts,
    ukmlaAttempts,
} from '@/db/schema';
import { RivisionMaterials } from '@/components/rivision-materials';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RivisionCard = {
    domain: string;
    difficulty: 'Foundation' | 'Core' | 'Advanced' | null;
    clusterKey: string | null;
    priorityScore: number;
    averageScore: number;
    totalAttempts: number;
    caseAttempts: number;
    ukmlaAttempts: number;
    rank: number;
    noteExists: boolean;
    isStale: boolean;
    contextType: 'category';
    contextId: string;
};

function noteScopeKey(domain: string, difficulty: string | null, clusterKey: string | null) {
    return `${domain}::${difficulty || 'any'}::${clusterKey || 'any'}`;
}

export default async function RivisionPage() {
    const { userId } = await auth();
    if (!userId) {
        redirect('/sign-in');
    }

    const [caseAttempts, ukmlaRows, fallbackCategoryStats] = await Promise.all([
        db.query.studentAttempts.findMany({
            where: eq(studentAttempts.userId, userId),
            orderBy: (attempts, { desc }) => [desc(attempts.completedAt)],
            limit: 80,
            with: {
                case: {
                    columns: {
                        id: true,
                        clinicalDomain: true,
                        difficultyLevel: true,
                        rivisionClusterKey: true,
                    },
                },
            },
        }),
        db.query.ukmlaAttempts.findMany({
            where: eq(ukmlaAttempts.userId, userId),
            orderBy: (attempts, { desc }) => [desc(attempts.completedAt)],
            limit: 80,
            with: {
                question: {
                    columns: {
                        id: true,
                        category: true,
                        difficultyLevel: true,
                        rivisionClusterKey: true,
                    },
                },
            },
        }),
        db.query.categoryStats.findMany({ where: eq(categoryStats.userId, userId) }),
    ]);

    const caseContextIds = caseAttempts.map((row) => String(row.case.id));
    const ukmlaContextIds = ukmlaRows.map((row) => String(row.question.id));

    const [cachedCaseClusters, cachedUkmlaClusters] = await Promise.all([
        caseContextIds.length > 0
            ? db.query.rivisionContextClusters.findMany({
                where: and(
                    eq(rivisionContextClusters.contextType, 'case'),
                    inArray(rivisionContextClusters.contextId, caseContextIds)
                ),
            })
            : Promise.resolve([]),
        ukmlaContextIds.length > 0
            ? db.query.rivisionContextClusters.findMany({
                where: and(
                    eq(rivisionContextClusters.contextType, 'ukmla_question'),
                    inArray(rivisionContextClusters.contextId, ukmlaContextIds)
                ),
            })
            : Promise.resolve([]),
    ]);

    const domains = new Set<string>();
    for (const row of caseAttempts) domains.add(row.case.clinicalDomain);
    for (const row of ukmlaRows) domains.add(row.question.category);
    for (const row of fallbackCategoryStats) domains.add(row.clinicalDomain);

    const domainList = Array.from(domains);

    const taxonomyRows = domainList.length > 0
        ? await db.query.rivisionNoteTaxonomy.findMany({
            where: inArray(rivisionNoteTaxonomy.domain, domainList),
            orderBy: (table, { asc }) => [asc(table.clusterKey)],
        })
        : [];

    const taxonomyByDomain = taxonomyRows.reduce((acc, row) => {
        if (!acc.has(row.domain)) acc.set(row.domain, [] as typeof taxonomyRows);
        acc.get(row.domain)!.push(row);
        return acc;
    }, new Map<string, typeof taxonomyRows>());

    const caseClusterMap = new Map(cachedCaseClusters.map((row) => [row.contextId, row.clusterKey]));
    const ukmlaClusterMap = new Map(cachedUkmlaClusters.map((row) => [row.contextId, row.clusterKey]));

    const aggregateMap = new Map<string, Omit<RivisionCard, 'rank' | 'noteExists' | 'isStale' | 'contextType' | 'contextId'>>();

    for (const row of caseAttempts) {
        const domain = row.case.clinicalDomain;
        const difficulty = row.case.difficultyLevel;
        const fallbackCluster = taxonomyByDomain.get(domain)?.[0]?.clusterKey || null;
        const clusterKey = row.case.rivisionClusterKey || caseClusterMap.get(String(row.case.id)) || fallbackCluster;

        const scope = noteScopeKey(domain, difficulty, clusterKey);
        const current = aggregateMap.get(scope) || {
            domain,
            difficulty,
            clusterKey,
            priorityScore: 0,
            averageScore: 0,
            totalAttempts: 0,
            caseAttempts: 0,
            ukmlaAttempts: 0,
        };

        current.totalAttempts += 1;
        current.caseAttempts += 1;
        current.averageScore += row.score;
        aggregateMap.set(scope, current);
    }

    for (const row of ukmlaRows) {
        const domain = row.question.category;
        const difficulty = row.question.difficultyLevel;
        const fallbackCluster = taxonomyByDomain.get(domain)?.[0]?.clusterKey || null;
        const clusterKey = row.question.rivisionClusterKey || ukmlaClusterMap.get(String(row.question.id)) || fallbackCluster;
        const score = row.isCorrect ? 100 : 0;

        const scope = noteScopeKey(domain, difficulty, clusterKey);
        const current = aggregateMap.get(scope) || {
            domain,
            difficulty,
            clusterKey,
            priorityScore: 0,
            averageScore: 0,
            totalAttempts: 0,
            caseAttempts: 0,
            ukmlaAttempts: 0,
        };

        current.totalAttempts += 1;
        current.ukmlaAttempts += 1;
        current.averageScore += score;
        aggregateMap.set(scope, current);
    }

    if (aggregateMap.size === 0) {
        for (const row of fallbackCategoryStats) {
            const domain = row.clinicalDomain;
            const clusterKey = taxonomyByDomain.get(domain)?.[0]?.clusterKey || null;
            const scope = noteScopeKey(domain, null, clusterKey);

            aggregateMap.set(scope, {
                domain,
                difficulty: null,
                clusterKey,
                priorityScore: 100 - row.averageScore,
                averageScore: row.averageScore,
                totalAttempts: row.totalAttempts,
                caseAttempts: row.totalAttempts,
                ukmlaAttempts: 0,
            });
        }
    }

    const cardsBase = Array.from(aggregateMap.values()).map((row) => {
        const normalizedAverage = row.totalAttempts > 0 ? Math.round(row.averageScore / row.totalAttempts) : 0;
        const weakness = Math.max(0, 100 - normalizedAverage);
        const frequencyBonus = Math.min(25, row.totalAttempts * 2);

        return {
            ...row,
            averageScore: normalizedAverage,
            priorityScore: weakness + frequencyBonus,
        };
    });

    const notes = await db.query.rivisionNotes.findMany({
        where: eq(rivisionNotes.userId, userId),
        columns: {
            domain: true,
            difficultyLevel: true,
            clusterKey: true,
            staleAt: true,
        },
    });

    const noteMap = new Map(notes.map((note) => [
        noteScopeKey(note.domain, note.difficultyLevel || null, note.clusterKey || null),
        note,
    ]));

    const cards: RivisionCard[] = cardsBase
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .map((row, index) => {
            const scope = noteScopeKey(row.domain, row.difficulty, row.clusterKey);
            const existing = noteMap.get(scope);
            const contextId = `${row.domain}|${row.difficulty || 'any'}|${row.clusterKey || 'any'}`;

            return {
                ...row,
                rank: index + 1,
                noteExists: Boolean(existing),
                isStale: Boolean(existing?.staleAt && new Date(existing.staleAt) <= new Date()),
                contextType: 'category',
                contextId,
            };
        });

    const weakCardCount = cards.filter((row) => row.averageScore < 70).length;

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-3xl">
                        <Sparkles className="h-7 w-7 text-primary" />
                        Rivision
                    </CardTitle>
                    <p className="text-muted-foreground">
                        Persistent AI revision notes linked to your weak domains, difficulty level, and question clusters.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {weakCardCount} weak clusters (&lt;70%)
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1">{cards.length} ranked clusters</span>
                </CardContent>
            </Card>

            <RivisionMaterials cards={cards} />
        </div>
    );
}
