'use server';

import OpenAI from 'openai';
import { and, asc, desc, eq, isNull, lte } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
    cases,
    rivisionContextClusters,
    rivisionNoteEvidence,
    rivisionNoteTaxonomy,
    rivisionNotes,
    studentAttempts,
    ukmlaAttempts,
    ukmlaQuestions,
} from '@/db/schema';
import { isAdmin } from '@/lib/auth-helpers';
import {
    generateRivisionMaterialSchema,
    getRivisionNoteSchema,
    refreshRivisionNoteSchema,
    rivisionNoteSchema,
    type GetRivisionNoteInput,
    type RefreshRivisionNoteInput,
    type RivisionContextType,
    type RivisionNote,
    type RivisionNoteKey,
} from '@/schemas/rivision';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_SOURCE_VERSION = process.env.RIVISION_SOURCE_VERSION || 'v1-gpt-4o-mini';

type ResolvedContext = {
    domain: string;
    difficulty: 'Foundation' | 'Core' | 'Advanced' | null;
    clusterKey: string | null;
};

type ClusterPerformance = {
    averageScore: number;
    totalAttempts: number;
};

function normalizeContextId(contextId: number | string) {
    return String(contextId);
}

function parseCategoryContext(contextId: string): ResolvedContext {
    const [domainRaw, difficultyRaw, clusterKeyRaw] = contextId.split('|');
    const domain = (domainRaw || '').trim();
    const difficulty = difficultyRaw === 'Foundation' || difficultyRaw === 'Core' || difficultyRaw === 'Advanced'
        ? difficultyRaw
        : null;
    const clusterKey = clusterKeyRaw && clusterKeyRaw !== 'any' ? clusterKeyRaw : null;

    if (!domain) {
        throw new Error('Invalid category context');
    }

    return { domain, difficulty, clusterKey };
}

function buildFallbackNote(domain: string, clusterKey: string | null): RivisionNote {
    const focus = clusterKey ? ` (${clusterKey.replaceAll('_', ' ')})` : '';

    return {
        title: `${domain} Rivision Brief${focus}`,
        summary:
            'Cached fallback note: focus on high-yield patterns, red flags, first-line investigations, and guideline-aligned management.',
        keyConcepts: [
            `${domain} pattern recognition and prioritization`,
            'Targeted investigations that change management',
            'Immediate stabilization and escalation triggers',
            'Definitive treatment and follow-up planning',
        ],
        commonMistakes: [
            'Missing immediate life-threatening differentials',
            'Choosing broad tests before focused bedside reasoning',
            'Delaying escalation when risk indicators are present',
        ],
        rapidChecklist: [
            'Confirm immediate ABCDE priorities',
            'State top diagnosis and key alternatives',
            'Order focused investigations with rationale',
            'Start first-line treatment immediately when indicated',
            'Plan disposition, escalation, and safety-net advice',
        ],
        practicePlan: [
            'Review one concise guideline summary',
            'Do a targeted MCQ set for this weak area',
            'Re-attempt one relevant case within 48 hours',
        ],
    };
}

async function getTaxonomyRows(domain: string) {
    return db.query.rivisionNoteTaxonomy.findMany({
        where: and(eq(rivisionNoteTaxonomy.domain, domain), eq(rivisionNoteTaxonomy.active, true)),
        orderBy: [asc(rivisionNoteTaxonomy.clusterKey)],
    });
}

function keywordScore(text: string, keywords: string[]) {
    if (!text || keywords.length === 0) return 0;
    const hay = text.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
        const normalized = keyword.toLowerCase().trim();
        if (!normalized) continue;
        if (hay.includes(normalized)) score += 1;
    }

    return score;
}

async function resolveClusterKeyFromText(
    domain: string,
    text: string,
    taggedClusterKey?: string | null
): Promise<string | null> {
    const taxonomy = await getTaxonomyRows(domain);
    if (taxonomy.length === 0) return null;

    if (taggedClusterKey) {
        const found = taxonomy.find((row) => row.clusterKey === taggedClusterKey);
        if (found) return found.clusterKey;
    }

    const ranked = taxonomy
        .map((row) => ({
            clusterKey: row.clusterKey,
            score: keywordScore(text, row.keywords || []),
        }))
        .sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score > 0) {
        return ranked[0].clusterKey;
    }

    return taxonomy[0].clusterKey;
}

async function persistContextCluster(
    contextType: RivisionContextType,
    contextId: string,
    resolved: ResolvedContext,
    matchedBy: 'metadata' | 'heuristic' | 'cached' = 'heuristic'
) {
    if (!resolved.clusterKey) return;

    await db
        .insert(rivisionContextClusters)
        .values({
            contextType,
            contextId,
            domain: resolved.domain,
            difficultyLevel: resolved.difficulty,
            clusterKey: resolved.clusterKey,
            matchedBy,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [rivisionContextClusters.contextType, rivisionContextClusters.contextId],
            set: {
                domain: resolved.domain,
                difficultyLevel: resolved.difficulty,
                clusterKey: resolved.clusterKey,
                matchedBy,
                updatedAt: new Date(),
            },
        });
}

async function resolveContext(input: GetRivisionNoteInput): Promise<ResolvedContext> {
    const contextId = normalizeContextId(input.contextId);

    const cached = await db.query.rivisionContextClusters.findFirst({
        where: and(
            eq(rivisionContextClusters.contextType, input.contextType),
            eq(rivisionContextClusters.contextId, contextId)
        ),
    });

    if (cached) {
        return {
            domain: cached.domain,
            difficulty: cached.difficultyLevel,
            clusterKey: cached.clusterKey,
        };
    }

    if (input.contextType === 'category') {
        const parsed = parseCategoryContext(contextId);
        const clusterKey = await resolveClusterKeyFromText(parsed.domain, parsed.domain, parsed.clusterKey);
        const resolved = { ...parsed, clusterKey };
        await persistContextCluster('category', contextId, resolved, parsed.clusterKey ? 'metadata' : 'heuristic');
        return resolved;
    }

    if (input.contextType === 'ukmla_question') {
        const questionId = Number(contextId);
        if (!Number.isInteger(questionId) || questionId <= 0) throw new Error('Invalid UKMLA question id');

        const question = await db.query.ukmlaQuestions.findFirst({
            where: eq(ukmlaQuestions.id, questionId),
            columns: {
                id: true,
                category: true,
                difficultyLevel: true,
                stem: true,
                explanation: true,
                rivisionClusterKey: true,
            },
        });

        if (!question) throw new Error('Question not found');

        const clusterKey = await resolveClusterKeyFromText(
            question.category,
            `${question.stem}\n${question.explanation}`,
            question.rivisionClusterKey
        );

        const resolved: ResolvedContext = {
            domain: question.category,
            difficulty: question.difficultyLevel,
            clusterKey,
        };

        await persistContextCluster('ukmla_question', contextId, resolved, question.rivisionClusterKey ? 'metadata' : 'heuristic');
        return resolved;
    }

    const caseId = Number(contextId);
    if (!Number.isInteger(caseId) || caseId <= 0) throw new Error('Invalid case id');

    const medicalCase = await db.query.cases.findFirst({
        where: eq(cases.id, caseId),
        columns: {
            id: true,
            clinicalDomain: true,
            difficultyLevel: true,
            title: true,
            description: true,
            rivisionClusterKey: true,
        },
    });

    if (!medicalCase) throw new Error('Case not found');

    const clusterKey = await resolveClusterKeyFromText(
        medicalCase.clinicalDomain,
        `${medicalCase.title}\n${medicalCase.description}`,
        medicalCase.rivisionClusterKey
    );

    const resolved: ResolvedContext = {
        domain: medicalCase.clinicalDomain,
        difficulty: medicalCase.difficultyLevel,
        clusterKey,
    };

    await persistContextCluster('case', contextId, resolved, medicalCase.rivisionClusterKey ? 'metadata' : 'heuristic');
    return resolved;
}

async function findScopedNote(userId: string, key: RivisionNoteKey) {
    const filters = [eq(rivisionNotes.userId, userId), eq(rivisionNotes.domain, key.domain)];

    if (key.difficulty === null) {
        filters.push(isNull(rivisionNotes.difficultyLevel));
    } else {
        filters.push(eq(rivisionNotes.difficultyLevel, key.difficulty));
    }

    if (key.clusterKey === null) {
        filters.push(isNull(rivisionNotes.clusterKey));
    } else {
        filters.push(eq(rivisionNotes.clusterKey, key.clusterKey));
    }

    return db.query.rivisionNotes.findFirst({
        where: and(...filters),
        orderBy: [desc(rivisionNotes.updatedAt)],
    });
}

async function findNoteByFallbackChain(userId: string, key: RivisionNoteKey) {
    const exact = await findScopedNote(userId, key);
    if (exact) return exact;

    if (key.difficulty !== null) {
        const difficultyLevel = await findScopedNote(userId, {
            domain: key.domain,
            difficulty: key.difficulty,
            clusterKey: null,
        });
        if (difficultyLevel) return difficultyLevel;
    }

    return findScopedNote(userId, {
        domain: key.domain,
        difficulty: null,
        clusterKey: null,
    });
}

function isScoreLow(score: number) {
    return score < 70;
}

async function getClusterPerformance(userId: string, key: RivisionNoteKey): Promise<ClusterPerformance> {
    const [caseRows, ukmlaRows] = await Promise.all([
        db.query.studentAttempts.findMany({
            where: eq(studentAttempts.userId, userId),
            orderBy: [desc(studentAttempts.completedAt)],
            limit: 80,
            with: {
                case: {
                    columns: {
                        id: true,
                        clinicalDomain: true,
                        difficultyLevel: true,
                        title: true,
                        description: true,
                    },
                },
            },
        }),
        db.query.ukmlaAttempts.findMany({
            where: eq(ukmlaAttempts.userId, userId),
            orderBy: [desc(ukmlaAttempts.completedAt)],
            limit: 80,
            with: {
                question: {
                    columns: {
                        id: true,
                        category: true,
                        difficultyLevel: true,
                        stem: true,
                        explanation: true,
                        rivisionClusterKey: true,
                    },
                },
            },
        }),
    ]);

    const scores: number[] = [];

    for (const row of caseRows) {
        if (row.case.clinicalDomain !== key.domain) continue;
        if (key.difficulty && row.case.difficultyLevel !== key.difficulty) continue;

        let cluster: string | null = null;
        if (key.clusterKey) {
            cluster = (
                await resolveContext({ contextType: 'case', contextId: row.case.id, forceRefresh: false })
            ).clusterKey;
            if (cluster !== key.clusterKey) continue;
        }

        scores.push(row.score);
    }

    for (const row of ukmlaRows) {
        if (row.question.category !== key.domain) continue;
        if (key.difficulty && row.question.difficultyLevel !== key.difficulty) continue;

        if (key.clusterKey) {
            const cluster = (
                await resolveContext({ contextType: 'ukmla_question', contextId: row.question.id, forceRefresh: false })
            ).clusterKey;
            if (cluster !== key.clusterKey) continue;
        }

        scores.push(row.isCorrect ? 100 : 0);
    }

    if (scores.length === 0) {
        return { averageScore: 0, totalAttempts: 0 };
    }

    const total = scores.reduce((sum, value) => sum + value, 0);
    return {
        averageScore: Math.round(total / scores.length),
        totalAttempts: scores.length,
    };
}

function shouldMarkStale(note: typeof rivisionNotes.$inferSelect, current: ClusterPerformance) {
    const snapshot = note.performanceSnapshot || { averageScore: 0, totalAttempts: 0, capturedAt: new Date(0).toISOString() };

    const scoreDelta = Math.abs((snapshot.averageScore || 0) - current.averageScore);
    const attemptDelta = Math.max(0, current.totalAttempts - (snapshot.totalAttempts || 0));
    const ageMs = Date.now() - new Date(note.lastGeneratedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    const staleByTimestamp = note.staleAt ? new Date(note.staleAt) <= new Date() : false;

    return scoreDelta >= 10 || attemptDelta >= 5 || ageDays >= 30 || staleByTimestamp;
}

async function collectEvidence(userId: string, key: RivisionNoteKey) {
    const [caseRows, ukmlaRows] = await Promise.all([
        db.query.studentAttempts.findMany({
            where: eq(studentAttempts.userId, userId),
            orderBy: [desc(studentAttempts.completedAt)],
            limit: 50,
            with: {
                case: {
                    columns: {
                        id: true,
                        clinicalDomain: true,
                        difficultyLevel: true,
                        title: true,
                        description: true,
                    },
                },
            },
        }),
        db.query.ukmlaAttempts.findMany({
            where: eq(ukmlaAttempts.userId, userId),
            orderBy: [desc(ukmlaAttempts.completedAt)],
            limit: 50,
            with: {
                question: {
                    columns: {
                        id: true,
                        category: true,
                        difficultyLevel: true,
                        stem: true,
                        explanation: true,
                    },
                },
            },
        }),
    ]);

    const caseEvidence: Array<{ attemptId: number; score: number; title: string; description: string }> = [];
    const ukmlaEvidence: Array<{ attemptId: number; isCorrect: boolean; stem: string; explanation: string }> = [];

    for (const row of caseRows) {
        if (row.case.clinicalDomain !== key.domain) continue;
        if (key.difficulty && row.case.difficultyLevel !== key.difficulty) continue;

        if (key.clusterKey) {
            const context = await resolveContext({ contextType: 'case', contextId: row.case.id, forceRefresh: false });
            if (context.clusterKey !== key.clusterKey) continue;
        }

        caseEvidence.push({
            attemptId: row.id,
            score: row.score,
            title: row.case.title,
            description: row.case.description,
        });
    }

    for (const row of ukmlaRows) {
        if (row.question.category !== key.domain) continue;
        if (key.difficulty && row.question.difficultyLevel !== key.difficulty) continue;

        if (key.clusterKey) {
            const context = await resolveContext({ contextType: 'ukmla_question', contextId: row.question.id, forceRefresh: false });
            if (context.clusterKey !== key.clusterKey) continue;
        }

        ukmlaEvidence.push({
            attemptId: row.id,
            isCorrect: row.isCorrect,
            stem: row.question.stem,
            explanation: row.question.explanation,
        });
    }

    return {
        caseEvidence: caseEvidence.slice(0, 8),
        ukmlaEvidence: ukmlaEvidence.slice(0, 8),
    };
}

async function generateNoteContent(key: RivisionNoteKey, evidence: Awaited<ReturnType<typeof collectEvidence>>) {
    if (!process.env.OPENAI_API_KEY) {
        return {
            note: buildFallbackNote(key.domain, key.clusterKey),
            source: 'fallback' as const,
        };
    }

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a senior UKMLA medical educator. Return strict JSON with concise personalized revision notes.',
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        task: 'Generate personalized revision notes for a student based on weak evidence',
                        context: {
                            domain: key.domain,
                            difficulty: key.difficulty,
                            clusterKey: key.clusterKey,
                        },
                        evidence,
                        outputShape: {
                            title: 'string',
                            summary: 'string',
                            keyConcepts: 'string[]',
                            commonMistakes: 'string[]',
                            rapidChecklist: 'string[]',
                            practicePlan: 'string[]',
                        },
                        constraints: [
                            'High yield only',
                            'No markdown',
                            'Actionable exam-oriented language',
                        ],
                    }),
                },
            ],
        });

        const content = completion.choices[0]?.message.content;
        if (!content) {
            return {
                note: buildFallbackNote(key.domain, key.clusterKey),
                source: 'fallback' as const,
            };
        }

        return {
            note: rivisionNoteSchema.parse(JSON.parse(content)),
            source: 'openai' as const,
        };
    } catch (error) {
        console.error('Rivision generation failed:', error);
        return {
            note: buildFallbackNote(key.domain, key.clusterKey),
            source: 'fallback' as const,
        };
    }
}

async function refreshRivisionNoteInternal(
    userId: string,
    key: RivisionNoteKey,
    sourceVersion?: string
) {
    const [performance, evidence] = await Promise.all([
        getClusterPerformance(userId, key),
        collectEvidence(userId, key),
    ]);

    const generated = await generateNoteContent(key, evidence);
    const now = new Date();

    const existing = await findScopedNote(userId, key);
    const snapshot = {
        averageScore: performance.averageScore,
        totalAttempts: performance.totalAttempts,
        capturedAt: now.toISOString(),
    };

    const payload = {
        userId,
        domain: key.domain,
        difficultyLevel: key.difficulty,
        clusterKey: key.clusterKey,
        title: generated.note.title,
        summary: generated.note.summary,
        keyConcepts: generated.note.keyConcepts,
        commonMistakes: generated.note.commonMistakes,
        rapidChecklist: generated.note.rapidChecklist,
        practicePlan: generated.note.practicePlan,
        sourceVersion: sourceVersion || DEFAULT_SOURCE_VERSION,
        performanceSnapshot: snapshot,
        staleAt: null,
        lastGeneratedAt: now,
        lastServedAt: now,
        updatedAt: now,
    };

    let noteId: number;

    if (existing) {
        const [updated] = await db
            .update(rivisionNotes)
            .set(payload)
            .where(eq(rivisionNotes.id, existing.id))
            .returning({ id: rivisionNotes.id });

        noteId = updated.id;
        await db.delete(rivisionNoteEvidence).where(eq(rivisionNoteEvidence.noteId, noteId));
    } else {
        const [inserted] = await db.insert(rivisionNotes).values(payload).returning({ id: rivisionNotes.id });
        noteId = inserted.id;
    }

    const evidenceRows = [
        ...evidence.caseEvidence.map((row) => ({
            noteId,
            sourceType: 'case_attempt' as const,
            sourceId: row.attemptId,
            weight: isScoreLow(row.score) ? 3 : 1,
        })),
        ...evidence.ukmlaEvidence.map((row) => ({
            noteId,
            sourceType: 'ukmla_attempt' as const,
            sourceId: row.attemptId,
            weight: row.isCorrect ? 1 : 3,
        })),
    ];

    if (evidenceRows.length > 0) {
        await db.insert(rivisionNoteEvidence).values(evidenceRows);
    }

    revalidatePath('/rivision');

    const saved = await db.query.rivisionNotes.findFirst({ where: eq(rivisionNotes.id, noteId) });
    return {
        note: saved,
        refreshedAt: now,
        source: generated.source,
    };
}

export async function getRivisionNote(input: GetRivisionNoteInput) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = getRivisionNoteSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    try {
        const resolved = await resolveContext(parsed.data);
        const noteKey: RivisionNoteKey = {
            domain: resolved.domain,
            difficulty: resolved.difficulty,
            clusterKey: resolved.clusterKey,
        };

        let note = await findNoteByFallbackChain(userId, noteKey);

        if (!note) {
            const refreshed = await refreshRivisionNoteInternal(userId, noteKey);
            return {
                success: true,
                note: refreshed.note,
                cacheStatus: 'miss' as const,
                noteKey,
            };
        }

        const stale = shouldMarkStale(note, await getClusterPerformance(userId, noteKey));

        if (parsed.data.forceRefresh) {
            const refreshed = await refreshRivisionNoteInternal(userId, noteKey);
            note = refreshed.note;
            return {
                success: true,
                note,
                cacheStatus: 'miss' as const,
                noteKey,
            };
        }

        await db
            .update(rivisionNotes)
            .set({
                lastServedAt: new Date(),
                staleAt: stale ? new Date() : null,
                updatedAt: new Date(),
            })
            .where(eq(rivisionNotes.id, note.id));

        if (stale) {
            void refreshRivisionNoteInternal(userId, noteKey).catch((error) => {
                console.error('Background rivision refresh failed:', error);
            });
        }

        return {
            success: true,
            note,
            cacheStatus: stale ? ('stale_hit' as const) : ('hit' as const),
            noteKey,
        };
    } catch (error) {
        console.error('Error resolving rivision note:', error);
        return { success: false, message: 'Failed to resolve Rivision note' };
    }
}

export async function refreshRivisionNote(input: RefreshRivisionNoteInput) {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const parsed = refreshRivisionNoteSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const noteKey: RivisionNoteKey = {
        domain: parsed.data.domain,
        difficulty: parsed.data.difficulty || null,
        clusterKey: parsed.data.clusterKey || null,
    };

    let sourceVersion = DEFAULT_SOURCE_VERSION;
    if (parsed.data.sourceVersionOverride) {
        const callerIsAdmin = await isAdmin();
        if (!callerIsAdmin) {
            return { success: false, message: 'Only admins can override source version' };
        }
        sourceVersion = parsed.data.sourceVersionOverride;
    }

    try {
        const refreshed = await refreshRivisionNoteInternal(userId, noteKey, sourceVersion);
        return {
            success: true,
            note: refreshed.note,
            refreshedAt: refreshed.refreshedAt,
        };
    } catch (error) {
        console.error('Error refreshing rivision note:', error);
        return { success: false, message: 'Failed to refresh Rivision note' };
    }
}

// Backward-compat wrapper used by the existing UI path.
export async function generateRivisionMaterial(input: { category: string }) {
    const parsed = generateRivisionMaterialSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const contextId = `${parsed.data.category}|any|any`;
    const result = await getRivisionNote({
        contextType: 'category',
        contextId,
        forceRefresh: false,
    });

    if (!result.success || !result.note) {
        return { success: false, message: result.message || 'Failed to generate rivision material' };
    }

    return {
        success: true,
        data: {
            title: result.note.title,
            summary: result.note.summary,
            keyConcepts: result.note.keyConcepts,
            commonMistakes: result.note.commonMistakes,
            rapidChecklist: result.note.rapidChecklist,
            practicePlan: result.note.practicePlan,
        },
    };
}

export async function markDueRivisionNotesStale() {
    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    await db
        .update(rivisionNotes)
        .set({ staleAt: new Date(), updatedAt: new Date() })
        .where(and(eq(rivisionNotes.userId, userId), lte(rivisionNotes.lastGeneratedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))));

    return { success: true };
}
