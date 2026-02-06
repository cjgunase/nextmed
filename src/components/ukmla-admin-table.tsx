'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { difficultyLevels, ukmlaCategories } from '@/db/schema';
import {
    deleteUkmlaQuestion,
    generateUkmlaQuestionsAction,
    toggleUkmlaPublish,
} from '@/actions/ukmla-admin';
import { useRouter } from 'next/navigation';

type Question = {
    id: number;
    stem: string;
    category: string;
    difficultyLevel: string;
    isPublished: boolean;
    verificationStatus: string;
    updatedAt: Date;
    options: { id: number; isCorrect: boolean }[];
};

type Props = {
    questions: Question[];
};

export function UkmlaAdminTable({ questions }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [prompt, setPrompt] = useState('');
    const [category, setCategory] = useState<(typeof ukmlaCategories)[number]>(ukmlaCategories[0]);
    const [difficulty, setDifficulty] = useState<(typeof difficultyLevels)[number]>(difficultyLevels[0]);
    const [count, setCount] = useState(5);

    const handleGenerate = () => {
        startTransition(async () => {
            const result = await generateUkmlaQuestionsAction({
                prompt,
                category,
                difficulty,
                count,
            });

            if (!result.success) {
                alert(result.message || 'Failed to generate questions');
                return;
            }

            setPrompt('');
            router.refresh();
        });
    };

    const handlePublishToggle = (id: number, currentStatus: boolean) => {
        startTransition(async () => {
            const result = await toggleUkmlaPublish(id, !currentStatus);
            if (!result.success) {
                alert(result.message || 'Failed to update publish status');
                return;
            }
            router.refresh();
        });
    };

    const handleDelete = (id: number) => {
        if (!confirm('Delete this question?')) return;

        startTransition(async () => {
            const result = await deleteUkmlaQuestion(id);
            if (!result.success) {
                alert(result.message || 'Failed to delete question');
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Generate UKMLA Drafts</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="md:col-span-5">
                        <Label>Prompt</Label>
                        <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Prompt for UKMLA question generation" />
                    </div>
                    <div>
                        <Label>Category</Label>
                        <Select value={category} onValueChange={(value) => setCategory(value as (typeof ukmlaCategories)[number])}>
                            <SelectTrigger>
                                <SelectValue />
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
                    <div>
                        <Label>Difficulty</Label>
                        <Select value={difficulty} onValueChange={(value) => setDifficulty(value as (typeof difficultyLevels)[number])}>
                            <SelectTrigger>
                                <SelectValue />
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
                    <div>
                        <Label>Count (1-20)</Label>
                        <Input
                            type="number"
                            min={1}
                            max={20}
                            value={count}
                            onChange={(event) => setCount(Math.max(1, Math.min(20, Number(event.target.value || 1))))}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button disabled={isPending || prompt.trim().length < 10} onClick={handleGenerate} className="w-full">
                            {isPending ? 'Generating...' : 'Generate Drafts'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">UKMLA Question Bank</h2>
                <Link href="/admin/ukmla/new">
                    <Button>Create Question</Button>
                </Link>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="p-3 text-left">Question</th>
                                    <th className="p-3 text-left">Category</th>
                                    <th className="p-3 text-left">Difficulty</th>
                                    <th className="p-3 text-left">Status</th>
                                    <th className="p-3 text-left">Updated</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questions.map((question) => {
                                    const correctCount = question.options.filter((option) => option.isCorrect).length;
                                    return (
                                        <tr key={question.id} className="border-b">
                                            <td className="p-3 max-w-[420px]">
                                                <div className="line-clamp-2 text-sm">{question.stem}</div>
                                                <div className="text-xs text-muted-foreground">Correct options: {correctCount}</div>
                                            </td>
                                            <td className="p-3 text-sm">{question.category}</td>
                                            <td className="p-3 text-sm">{question.difficultyLevel}</td>
                                            <td className="p-3 text-sm">
                                                {question.isPublished ? 'Published' : 'Draft'} • {question.verificationStatus}
                                            </td>
                                            <td className="p-3 text-sm text-muted-foreground">
                                                {new Date(question.updatedAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/admin/ukmla/${question.id}/edit`}>
                                                        <Button size="sm" variant="outline">Edit</Button>
                                                    </Link>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handlePublishToggle(question.id, question.isPublished)}
                                                        disabled={isPending}
                                                    >
                                                        {question.isPublished ? 'Unpublish' : 'Publish'}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDelete(question.id)}
                                                        disabled={isPending}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
