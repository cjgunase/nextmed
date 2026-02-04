'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useTransition } from 'react';

interface CasesFilterControlsProps {
    domains: string[];
    difficulties: string[];
}

export function CasesFilterControls({ domains, difficulties }: CasesFilterControlsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

    const selectedDomain = searchParams.get('domain') || 'all';
    const selectedDifficulty = searchParams.get('difficulty') || 'all';

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === 'all' || value === '') {
            params.delete(key);
        } else {
            params.set(key, value);
        }

        // Reset to page 1 when filters change
        params.delete('page');

        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilter('search', searchQuery);
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        startTransition(() => {
            router.push('/cases');
        });
    };

    const hasActiveFilters = selectedDomain !== 'all' || selectedDifficulty !== 'all' || searchQuery;

    return (
        <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold mb-4">Filter Cases</h2>

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit}>
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Search cases by title, description, or domain..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={isPending}>
                        Search
                    </Button>
                </div>
            </form>

            {/* Domain Filter */}
            <div>
                <label className="text-sm font-medium mb-2 block">
                    Clinical Domain ({domains.length})
                </label>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={selectedDomain === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('domain', 'all')}
                        disabled={isPending}
                    >
                        All Domains
                    </Button>
                    {domains.map((domain) => (
                        <Button
                            key={domain}
                            variant={selectedDomain === domain ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateFilter('domain', domain)}
                            disabled={isPending}
                        >
                            {domain}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Difficulty Filter */}
            <div>
                <label className="text-sm font-medium mb-2 block">Difficulty Level</label>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={selectedDifficulty === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('difficulty', 'all')}
                        disabled={isPending}
                    >
                        All Levels
                    </Button>
                    {difficulties.map((difficulty) => (
                        <Button
                            key={difficulty}
                            variant={selectedDifficulty === difficulty ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateFilter('difficulty', difficulty)}
                            disabled={isPending}
                        >
                            {difficulty}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
                <div className="pt-2 border-t">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        disabled={isPending}
                    >
                        Clear All Filters
                    </Button>
                </div>
            )}
        </div>
    );
}
