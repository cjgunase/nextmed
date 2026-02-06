'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Props = {
    categories: readonly string[];
    difficulties: readonly string[];
};

export function UkmlaFilterControls({ categories, difficulties }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get('search') || '');

    const values = useMemo(
        () => ({
            category: searchParams.get('category') || 'all',
            difficulty: searchParams.get('difficulty') || 'all',
            status: searchParams.get('status') || 'all',
        }),
        [searchParams]
    );

    const updateParams = (updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());

        Object.entries(updates).forEach(([key, value]) => {
            if (!value || value === 'all') params.delete(key);
            else params.set(key, value);
        });

        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
    };

    const applySearch = () => {
        updateParams({ search: search.trim() });
    };

    return (
        <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Select value={values.category} onValueChange={(value) => updateParams({ category: value })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={values.difficulty} onValueChange={(value) => updateParams({ difficulty: value })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All difficulties</SelectItem>
                        {difficulties.map((difficulty) => (
                            <SelectItem key={difficulty} value={difficulty}>
                                {difficulty}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={values.status} onValueChange={(value) => updateParams({ status: value })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All questions</SelectItem>
                        <SelectItem value="due">Due for review</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex gap-2">
                    <Input
                        placeholder="Search stem"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') applySearch();
                        }}
                    />
                    <Button type="button" variant="outline" onClick={applySearch}>
                        Search
                    </Button>
                </div>
            </div>
        </div>
    );
}
