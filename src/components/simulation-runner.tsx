'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { recordAttempt } from '@/actions/student';
import Link from 'next/link';

// Define types based on what we expect from getSimulation
// We define them here or import them if we had a shared type definition for the Action return.
// For now, strict local definition is safest to match the requirement "Assume types match".

interface Option {
    id: number;
    text: string;
    scoreWeight: number;
    feedback: string;
}

interface Stage {
    id: number;
    stageOrder: number;
    narrative: string;
    clinicalData: Record<string, unknown> | unknown;
    options: Option[];
}

interface Simulation {
    id: number;
    title: string;
    stages: Stage[];
}

interface SimulationRunnerProps {
    simulation: Simulation;
}

export function SimulationRunner({ simulation }: SimulationRunnerProps) {
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedOption, setSelectedOption] = useState<Option | null>(null);
    const [isGameFinished, setIsGameFinished] = useState(false);
    const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
    const [selectedOptionIds, setSelectedOptionIds] = useState<Record<number, number>>({});
    const attemptSavedRef = useRef(false);

    // Derived state
    const currentStage = simulation.stages[currentStageIndex];

    const handleOptionSelect = (option: Option) => {
        if (selectedOption) return; // Prevent changing selection

        setSelectedOption(option);
        setScore((prev) => prev + option.scoreWeight);
        setSelectedOptionIds((prev) => ({
            ...prev,
            [currentStage.id]: option.id,
        }));
    };

    const handleNextStage = () => {
        const nextIndex = currentStageIndex + 1;
        if (nextIndex < simulation.stages.length) {
            setCurrentStageIndex(nextIndex);
            setSelectedOption(null);
        } else {
            setIsGameFinished(true);
        }
    };

    // Record attempt when game finishes
    useEffect(() => {
        if (isGameFinished && !attemptSavedRef.current) {
            attemptSavedRef.current = true;
            void recordAttempt(simulation.id, Object.values(selectedOptionIds)).then((result) => {
                if (result.success) {
                    if (result.nextReviewDate) {
                        setNextReviewDate(new Date(result.nextReviewDate));
                    }
                } else {
                    console.error('Failed to save attempt:', result.message);
                }
            });
        }
    }, [isGameFinished, simulation.id, selectedOptionIds]);

    if (isGameFinished) {
        return (
            <div className="max-w-2xl mx-auto p-4 space-y-6">
                <Card className="border-t-4 border-blue-500 shadow-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-gray-800">Simulation Complete</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        <p className="text-gray-600 text-lg">
                            You have completed the scenario: <br />
                            <span className="font-semibold text-gray-900">{simulation.title}</span>
                        </p>
                        <div className="py-6 flex flex-col items-center gap-6">
                            <div className="inline-flex flex-col items-center justify-center p-6 bg-blue-50 rounded-full w-32 h-32">
                                <span className="text-sm text-blue-600 uppercase font-bold tracking-wider">Score</span>
                                <span className="text-4xl font-extrabold text-blue-700">{score}</span>
                            </div>

                            {nextReviewDate && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-sm w-full animate-in fade-in zoom-in duration-500">
                                    <h3 className="font-semibold text-yellow-800 mb-1 flex items-center justify-center gap-2">
                                        <span className="text-xl">📅</span> Next Review
                                    </h3>
                                    <p className="text-yellow-700">
                                        Scheduled for: <span className="font-bold">{nextReviewDate.toLocaleDateString()}</span>
                                    </p>
                                    <p className="text-xs text-yellow-600 mt-1">
                                        (Spaced Repetition System optimized)
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center gap-4">
                            <Link href="/cases">
                                <Button variant="outline">Back to Cases</Button>
                            </Link>
                            <Link href="/review">
                                <Button variant="secondary">Review Queue</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentStage) {
        return <div>Error: No stage found.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{simulation.title}</h1>
                <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                    <span>Stage {currentStageIndex + 1} of {simulation.stages.length}</span>
                    <span>Current Score: <span className={cn("font-medium", score < 0 ? "text-red-500" : "text-green-600")}>{score}</span></span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Stage Content */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="shadow-sm border-l-4 border-l-blue-500">
                        <CardHeader>
                            <CardTitle className="text-xl text-gray-800">Clinical Narrative</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line text-lg">
                                {currentStage.narrative}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Options */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700 text-lg">Decisions</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {currentStage.options.map((option) => (
                                <Button
                                    key={option.id}
                                    variant={selectedOption?.id === option.id ? "default" : "outline"}
                                    className={cn(
                                        "h-auto py-4 px-6 justify-start text-left whitespace-normal text-base border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all",
                                        selectedOption?.id === option.id
                                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                            : "text-gray-700",
                                        selectedOption && selectedOption.id !== option.id && "opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={() => handleOptionSelect(option)}
                                    disabled={!!selectedOption}
                                >
                                    {option.text}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Feedback & Navigation */}
                    {selectedOption && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-blue-50 border-blue-100">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-blue-900 mb-2">Outcome</h4>
                                        <p className="text-blue-800">{selectedOption.feedback}</p>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <Button onClick={handleNextStage} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                                            {currentStageIndex + 1 < simulation.stages.length ? "Next Stage" : "Finish Simulation"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                {/* Sidebar: Clinical Data */}
                <div className="md:col-span-1">
                    <Card className="sticky top-6">
                        <CardHeader className="bg-gray-50 border-b pb-3">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">Clinical Data</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[calc(100vh-300px)] min-h-[300px]">
                                {currentStage.clinicalData ? (
                                    <div className="p-4 space-y-4">
                                        {Object.entries(currentStage.clinicalData as Record<string, unknown>).map(([key, value]) => {
                                            // Skip empty or null values if desired, or just render all
                                            if (value === null || value === undefined) return null;

                                            return (
                                                <div key={key} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                                    <dt className="text-xs font-semibold text-gray-400 uppercase mb-1">{key}</dt>
                                                    <dd className="font-mono text-sm font-medium text-gray-800 break-words">
                                                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                    </dd>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center text-gray-400 italic text-sm">
                                        No new clinical data available for this stage.
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
