'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Brain, Loader2, Medal, RefreshCw, Sparkles } from 'lucide-react';
import { getRivisionNote, refreshRivisionNote } from '@/actions/rivision';
import type { RivisionNote } from '@/schemas/rivision';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

type RivisionMaterialsProps = {
    cards: RivisionCard[];
};

type NoteState = {
    note: RivisionNote;
    cacheStatus: 'hit' | 'miss' | 'stale_hit';
};

function getCardId(card: RivisionCard) {
    return `${card.domain}::${card.difficulty || 'any'}::${card.clusterKey || 'any'}`;
}

export function RivisionMaterials({ cards }: RivisionMaterialsProps) {
    const [isPending, startTransition] = useTransition();
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [notesByCard, setNotesByCard] = useState<Record<string, NoteState>>({});
    const [errorsByCard, setErrorsByCard] = useState<Record<string, string>>({});

    const loadNote = (card: RivisionCard, forceRefresh: boolean = false) => {
        const cardId = getCardId(card);
        setActiveCardId(cardId);
        setErrorsByCard((prev) => ({ ...prev, [cardId]: '' }));

        startTransition(async () => {
            if (forceRefresh) {
                const result = await refreshRivisionNote({
                    domain: card.domain,
                    difficulty: card.difficulty || undefined,
                    clusterKey: card.clusterKey || undefined,
                });

                if (!result.success || !result.note) {
                    setErrorsByCard((prev) => ({
                        ...prev,
                        [cardId]: result.message || 'Failed to refresh rivision note',
                    }));
                    setActiveCardId(null);
                    return;
                }
                const note = result.note;

                setNotesByCard((prev) => ({
                    ...prev,
                    [cardId]: {
                        note: {
                            title: note.title,
                            summary: note.summary,
                            keyConcepts: note.keyConcepts,
                            commonMistakes: note.commonMistakes,
                            rapidChecklist: note.rapidChecklist,
                            practicePlan: note.practicePlan,
                        },
                        cacheStatus: 'miss',
                    },
                }));

                setActiveCardId(null);
                return;
            }

            const result = await getRivisionNote({
                contextType: card.contextType,
                contextId: card.contextId,
                forceRefresh: false,
            });

            if (!result.success || !result.note) {
                setErrorsByCard((prev) => ({
                    ...prev,
                    [cardId]: result.message || 'Failed to load rivision note',
                }));
                setActiveCardId(null);
                return;
            }
            const note = result.note;

            setNotesByCard((prev) => ({
                ...prev,
                [cardId]: {
                    note: {
                        title: note.title,
                        summary: note.summary,
                        keyConcepts: note.keyConcepts,
                        commonMistakes: note.commonMistakes,
                        rapidChecklist: note.rapidChecklist,
                        practicePlan: note.practicePlan,
                    },
                    cacheStatus: result.cacheStatus,
                },
            }));
            setActiveCardId(null);
        });
    };

    return (
        <div className="space-y-6">
            {cards.map((card) => {
                const cardId = getCardId(card);
                const noteState = notesByCard[cardId];
                const error = errorsByCard[cardId];
                const loading = isPending && activeCardId === cardId;

                return (
                    <Card key={cardId} className="border-border/80">
                        <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <CardTitle className="flex items-center gap-2 text-2xl">
                                        <Brain className="h-5 w-5 text-primary" />
                                        {card.domain}
                                    </CardTitle>
                                    <CardDescription>
                                        Cluster: <span className="font-medium">{card.clusterKey || 'domain_general'}</span>
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="destructive">Priority #{card.rank}</Badge>
                                    <Badge variant="outline">
                                        <Medal className="mr-1 h-3.5 w-3.5" />
                                        Score {card.priorityScore}
                                    </Badge>
                                    <Badge variant="outline">Avg {card.averageScore}%</Badge>
                                    {card.difficulty && <Badge variant="outline">{card.difficulty}</Badge>}
                                    <Badge variant="secondary">{card.totalAttempts} attempts</Badge>
                                    {card.noteExists && !card.isStale && <Badge variant="default">Fresh</Badge>}
                                    {card.noteExists && card.isStale && <Badge variant="outline">Stale</Badge>}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                <span>Cases: {card.caseAttempts}</span>
                                <span>UKMLA: {card.ukmlaAttempts}</span>
                                {noteState && <span>Cache: {noteState.cacheStatus}</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    className="gap-2"
                                    onClick={() => loadNote(card, false)}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            Load Cached Note
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => loadNote(card, true)}
                                    disabled={loading}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh Note
                                </Button>
                            </div>

                            {error && (
                                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                    <AlertTriangle className="mr-2 inline-block h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            {noteState && (
                                <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                                    <h3 className="text-lg font-semibold">{noteState.note.title}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{noteState.note.summary}</p>
                                    <Separator />
                                    <section className="space-y-2">
                                        <h4 className="font-medium">Key Concepts</h4>
                                        <ul className="list-disc space-y-1 pl-5 text-sm">
                                            {noteState.note.keyConcepts.map((entry) => (
                                                <li key={entry}>{entry}</li>
                                            ))}
                                        </ul>
                                    </section>
                                    <section className="space-y-2">
                                        <h4 className="font-medium">Common Mistakes</h4>
                                        <ul className="list-disc space-y-1 pl-5 text-sm">
                                            {noteState.note.commonMistakes.map((entry) => (
                                                <li key={entry}>{entry}</li>
                                            ))}
                                        </ul>
                                    </section>
                                    <section className="space-y-2">
                                        <h4 className="font-medium">Rapid Checklist</h4>
                                        <ul className="list-disc space-y-1 pl-5 text-sm">
                                            {noteState.note.rapidChecklist.map((entry) => (
                                                <li key={entry}>{entry}</li>
                                            ))}
                                        </ul>
                                    </section>
                                    <section className="space-y-2">
                                        <h4 className="font-medium">Practice Plan</h4>
                                        <ul className="list-disc space-y-1 pl-5 text-sm">
                                            {noteState.note.practicePlan.map((entry) => (
                                                <li key={entry}>{entry}</li>
                                            ))}
                                        </ul>
                                    </section>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
