'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recordUkmlaAttempt } from '@/actions/ukmla-student';

type Option = {
    id: number;
    text: string;
    isCorrect: boolean;
    optionOrder: number;
};

type Question = {
    id: number;
    stem: string;
    explanation: string;
    category: string;
    difficultyLevel: string;
    options: Option[];
};

type UkmlaPlayerProps = {
    question: Question;
    nextQuestionId: number | null;
};

export function UkmlaPlayer({ question, nextQuestionId }: UkmlaPlayerProps) {
    const router = useRouter();
    const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{ isCorrect: boolean; score: number } | null>(null);
    const [isPending, startTransition] = useTransition();

    const selectedOption = useMemo(
        () => question.options.find((option) => option.id === selectedOptionId) || null,
        [question.options, selectedOptionId]
    );

    const submitAnswer = () => {
        if (!selectedOptionId || submitted) return;

        startTransition(async () => {
            const response = await recordUkmlaAttempt({
                questionId: question.id,
                selectedOptionId,
            });

            if (!response.success) {
                alert(response.message || 'Failed to submit answer');
                return;
            }

            setSubmitted(true);
            setResult({
                isCorrect: Boolean(response.data?.isCorrect),
                score: Number(response.data?.score || 0),
            });
        });
    };

    const goNext = () => {
        if (nextQuestionId) {
            router.push(`/ukmla/${nextQuestionId}`);
            return;
        }

        router.push('/ukmla');
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <Card>
                <CardHeader>
                    <div className="text-sm text-muted-foreground">
                        {question.category} • {question.difficultyLevel}
                    </div>
                    <CardTitle className="text-xl leading-relaxed">{question.stem}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {question.options
                        .sort((a, b) => a.optionOrder - b.optionOrder)
                        .map((option, index) => {
                            const label = String.fromCharCode(65 + index);
                            const isSelected = selectedOptionId === option.id;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`w-full rounded-md border p-3 text-left transition ${
                                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                                    } ${submitted ? 'cursor-not-allowed opacity-80' : ''}`}
                                    onClick={() => {
                                        if (!submitted) setSelectedOptionId(option.id);
                                    }}
                                    disabled={submitted}
                                >
                                    <span className="mr-2 font-semibold">{label}.</span>
                                    {option.text}
                                </button>
                            );
                        })}

                    {!submitted ? (
                        <Button onClick={submitAnswer} disabled={!selectedOptionId || isPending}>
                            {isPending ? 'Submitting...' : 'Submit Answer'}
                        </Button>
                    ) : (
                        <div
                            className={`rounded-md border p-4 ${
                                result?.isCorrect
                                    ? 'border-green-500/30 bg-green-500/10'
                                    : 'border-red-500/30 bg-red-500/10'
                            }`}
                        >
                            <p className="font-semibold">
                                {result?.isCorrect ? 'Correct' : 'Incorrect'} ({result?.score ?? 0} points)
                            </p>
                            <p className="mt-2 text-sm">{question.explanation}</p>
                            {selectedOption && !selectedOption.isCorrect && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    You selected: {selectedOption.text}
                                </p>
                            )}
                            <Button className="mt-4" onClick={goNext}>
                                {nextQuestionId ? 'Next Question' : 'Back to UKMLA'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
