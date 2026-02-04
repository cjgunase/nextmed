'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Case, CaseStage } from '@/db/schema';

type CaseWithStages = Case & { stages: CaseStage[] };

interface CasesFilterProps {
    cases: CaseWithStages[];
}

export function CasesFilter({ cases }: CasesFilterProps) {
    const [selectedDomain, setSelectedDomain] = useState<string>('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Extract unique domains and difficulties from cases
    const { domains, difficulties } = useMemo(() => {
        const domainSet = new Set(cases.map((c) => c.clinicalDomain));
        const difficultySet = new Set(cases.map((c) => c.difficultyLevel));

        return {
            domains: Array.from(domainSet).sort(),
            difficulties: Array.from(difficultySet).sort((a, b) => {
                // Sort by difficulty order: Foundation, Core, Advanced
                const order = ['Foundation', 'Core', 'Advanced'];
                return order.indexOf(a) - order.indexOf(b);
            }),
        };
    }, [cases]);

    // Filter cases based on selections
    const filteredCases = useMemo(() => {
        return cases.filter((caseItem) => {
            const matchesDomain =
                selectedDomain === 'all' || caseItem.clinicalDomain === selectedDomain;
            const matchesDifficulty =
                selectedDifficulty === 'all' || caseItem.difficultyLevel === selectedDifficulty;
            const matchesSearch =
                searchQuery === '' ||
                caseItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                caseItem.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                caseItem.clinicalDomain.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesDomain && matchesDifficulty && matchesSearch;
        });
    }, [cases, selectedDomain, selectedDifficulty, searchQuery]);

    // Group filtered cases by domain and difficulty
    const groupedCases = useMemo(() => {
        const grouped: Record<string, Record<string, CaseWithStages[]>> = {};

        filteredCases.forEach((caseItem) => {
            if (!grouped[caseItem.clinicalDomain]) {
                grouped[caseItem.clinicalDomain] = {};
            }
            if (!grouped[caseItem.clinicalDomain][caseItem.difficultyLevel]) {
                grouped[caseItem.clinicalDomain][caseItem.difficultyLevel] = [];
            }
            grouped[caseItem.clinicalDomain][caseItem.difficultyLevel].push(caseItem);
        });

        return grouped;
    }, [filteredCases]);

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Foundation':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'Core':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'Advanced':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters Section */}
            <div className="bg-card border rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold mb-4">Filter Cases</h2>

                {/* Search Bar */}
                <div>
                    <Input
                        type="text"
                        placeholder="Search cases by title, description, or domain..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full"
                    />
                </div>

                {/* Domain Filter */}
                <div>
                    <label className="text-sm font-medium mb-2 block">
                        Clinical Domain ({domains.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={selectedDomain === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDomain('all')}
                        >
                            All Domains
                        </Button>
                        {domains.map((domain) => (
                            <Button
                                key={domain}
                                variant={selectedDomain === domain ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedDomain(domain)}
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
                            onClick={() => setSelectedDifficulty('all')}
                        >
                            All Levels
                        </Button>
                        {difficulties.map((difficulty) => (
                            <Button
                                key={difficulty}
                                variant={selectedDifficulty === difficulty ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedDifficulty(difficulty)}
                            >
                                {difficulty}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Active Filters Summary */}
                {(selectedDomain !== 'all' || selectedDifficulty !== 'all' || searchQuery) && (
                    <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Showing {filteredCases.length} of {cases.length} cases
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedDomain('all');
                                    setSelectedDifficulty('all');
                                    setSearchQuery('');
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Cases Display - Grouped by Domain */}
            {filteredCases.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                    <h3 className="text-xl font-semibold mb-2">No cases found</h3>
                    <p className="text-muted-foreground">
                        Try adjusting your filters or search query
                    </p>
                </div>
            ) : (
                <div className="space-y-10">
                    {Object.entries(groupedCases)
                        .sort(([domainA], [domainB]) => domainA.localeCompare(domainB))
                        .map(([domain, difficultyCases]) => {
                            // Flatten all cases in this domain regardless of difficulty
                            const allCasesInDomain = Object.values(difficultyCases).flat();

                            return (
                                <div key={domain} className="space-y-6">
                                    {/* Domain Header */}
                                    <div className="flex items-center gap-3 border-b pb-3">
                                        <h2 className="text-2xl font-bold text-foreground">{domain}</h2>
                                        <Badge variant="secondary" className="text-sm px-3 py-1">
                                            {allCasesInDomain.length}{' '}
                                            {allCasesInDomain.length === 1 ? 'case' : 'cases'}
                                        </Badge>
                                    </div>

                                    {/* Single Grid for All Cases in Domain */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {allCasesInDomain
                                            .sort((a, b) => {
                                                // Sort by difficulty: Foundation < Core < Advanced
                                                const order = ['Foundation', 'Core', 'Advanced'];
                                                return order.indexOf(a.difficultyLevel) - order.indexOf(b.difficultyLevel);
                                            })
                                            .map((caseItem) => (
                                                <Link
                                                    key={caseItem.id}
                                                    href={`/cases/${caseItem.id}`}
                                                    className="block h-full group"
                                                >
                                                    <div className="border rounded-xl p-5 hover:border-primary transition-all duration-200 h-full flex flex-col hover:shadow-lg hover:scale-[1.02] bg-card">
                                                        <div className="flex items-start justify-between mb-3 gap-2">
                                                            <h4 className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors flex-1">
                                                                {caseItem.title}
                                                            </h4>
                                                            <div className="flex flex-col gap-1 shrink-0">
                                                                {caseItem.isPublished ? (
                                                                    <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded-md font-medium">
                                                                        Published
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400 rounded-md font-medium">
                                                                        Draft
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Difficulty Badge */}
                                                        <div className="mb-3">
                                                            <span
                                                                className={`inline-block px-3 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(
                                                                    caseItem.difficultyLevel
                                                                )}`}
                                                            >
                                                                {caseItem.difficultyLevel}
                                                            </span>
                                                        </div>

                                                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow leading-relaxed">
                                                            {caseItem.description}
                                                        </p>

                                                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-3 border-t">
                                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">
                                                                Rigour: {caseItem.rigourScore ?? 0}/100
                                                            </span>
                                                            <span className="font-semibold text-primary">
                                                                {caseItem.stages.length}{' '}
                                                                {caseItem.stages.length !== 1 ? 'stages' : 'stage'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
