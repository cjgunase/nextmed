'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ukmlaCategories, difficultyLevels } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { createUkmlaQuestion, updateUkmlaQuestion } from '@/actions/ukmla-admin';

type OptionInput = {
    id?: number;
    text: string;
    isCorrect: boolean;
    optionOrder?: number;
};

type ExistingQuestion = {
    id: number;
    stem: string;
    explanation: string;
    category: (typeof ukmlaCategories)[number];
    difficultyLevel: (typeof difficultyLevels)[number];
    verificationStatus: 'draft' | 'verified' | 'rejected';
    qualityScore: number;
    rigourScore: number;
    isPublished: boolean;
    options: OptionInput[];
};

type Props = {
    question?: ExistingQuestion;
};

function buildDefaultOptions(): OptionInput[] {
    return [
        { text: '', isCorrect: true, optionOrder: 1 },
        { text: '', isCorrect: false, optionOrder: 2 },
        { text: '', isCorrect: false, optionOrder: 3 },
        { text: '', isCorrect: false, optionOrder: 4 },
    ];
}

export function UkmlaAdminForm({ question }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [stem, setStem] = useState(question?.stem || '');
    const [explanation, setExplanation] = useState(question?.explanation || '');
    const [category, setCategory] = useState<(typeof ukmlaCategories)[number]>(
        question?.category || ukmlaCategories[0]
    );
    const [difficultyLevel, setDifficultyLevel] = useState<(typeof difficultyLevels)[number]>(
        question?.difficultyLevel || difficultyLevels[0]
    );
    const [verificationStatus, setVerificationStatus] = useState<'draft' | 'verified' | 'rejected'>(
        question?.verificationStatus || 'draft'
    );
    const [qualityScore, setQualityScore] = useState<number>(question?.qualityScore ?? 0);
    const [rigourScore, setRigourScore] = useState<number>(question?.rigourScore ?? 0);
    const [isPublished, setIsPublished] = useState<boolean>(question?.isPublished ?? false);
    const [options, setOptions] = useState<OptionInput[]>(
        question?.options?.length ? question.options : buildDefaultOptions()
    );

    const onOptionChange = (index: number, next: Partial<OptionInput>) => {
        setOptions((prev) =>
            prev.map((option, optIndex) => {
                if (optIndex !== index) return option;
                return { ...option, ...next };
            })
        );
    };

    const markCorrect = (index: number) => {
        setOptions((prev) =>
            prev.map((option, optIndex) => ({
                ...option,
                isCorrect: optIndex === index,
            }))
        );
    };

    const addOption = () => {
        setOptions((prev) => {
            if (prev.length >= 8) return prev;
            return [...prev, { text: '', isCorrect: false, optionOrder: prev.length + 1 }];
        });
    };

    const removeOption = (index: number) => {
        setOptions((prev) => {
            if (prev.length <= 2) return prev;
            return prev
                .filter((_, optIndex) => optIndex !== index)
                .map((option, optIndex) => ({ ...option, optionOrder: optIndex + 1 }));
        });
    };

    const handleSubmit = () => {
        startTransition(async () => {
            const payload = {
                stem,
                explanation,
                category,
                difficultyLevel,
                options: options.map((option, index) => ({
                    id: option.id,
                    text: option.text,
                    isCorrect: option.isCorrect,
                    optionOrder: index + 1,
                })),
            };

            const response = question
                ? await updateUkmlaQuestion({
                      id: question.id,
                      ...payload,
                      verificationStatus,
                      qualityScore,
                      rigourScore,
                      isPublished,
                  })
                : await createUkmlaQuestion(payload);

            if (!response.success) {
                alert(response.message || 'Failed to save question');
                return;
            }

            router.push('/admin/ukmla');
            router.refresh();
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{question ? 'Edit UKMLA Question' : 'Create UKMLA Question'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Question Stem</Label>
                    <Textarea value={stem} onChange={(event) => setStem(event.target.value)} className="min-h-28" />
                </div>

                <div className="space-y-2">
                    <Label>Explanation</Label>
                    <Textarea
                        value={explanation}
                        onChange={(event) => setExplanation(event.target.value)}
                        className="min-h-28"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={(value) => setCategory(value as (typeof ukmlaCategories)[number])}>
                            <SelectTrigger>
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {ukmlaCategories.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select
                            value={difficultyLevel}
                            onValueChange={(value) => setDifficultyLevel(value as (typeof difficultyLevels)[number])}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Difficulty" />
                            </SelectTrigger>
                            <SelectContent>
                                {difficultyLevels.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {question && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label>Verification</Label>
                            <Select value={verificationStatus} onValueChange={(value) => setVerificationStatus(value as 'draft' | 'verified' | 'rejected')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Quality Score</Label>
                            <Input
                                type="number"
                                value={qualityScore}
                                onChange={(event) => setQualityScore(Number(event.target.value || 0))}
                                min={0}
                                max={100}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rigour Score</Label>
                            <Input
                                type="number"
                                value={rigourScore}
                                onChange={(event) => setRigourScore(Number(event.target.value || 0))}
                                min={0}
                                max={100}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Published</Label>
                            <div className="flex h-10 items-center rounded-md border px-3">
                                <Checkbox checked={isPublished} onCheckedChange={(value) => setIsPublished(Boolean(value))} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label>Options (Exactly one correct)</Label>
                        <Button type="button" variant="outline" onClick={addOption}>
                            Add Option
                        </Button>
                    </div>

                    {options.map((option, index) => (
                        <div key={`${option.id || 'new'}-${index}`} className="rounded-md border p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="text-sm font-medium">Option {index + 1}</div>
                                <Button type="button" variant="ghost" onClick={() => removeOption(index)}>
                                    Remove
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Input
                                    value={option.text}
                                    onChange={(event) => onOptionChange(index, { text: event.target.value })}
                                    placeholder="Option text"
                                />
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={option.isCorrect}
                                        onCheckedChange={(value) => {
                                            if (value) markCorrect(index);
                                        }}
                                    />
                                    Mark as correct answer
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <Button onClick={handleSubmit} disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Question'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.push('/admin/ukmla')}>
                        Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
