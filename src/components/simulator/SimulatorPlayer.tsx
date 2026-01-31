"use client";

import { useState } from "react";
import { CaseWithStagesAndOptions } from "@/types/simulator-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PatientPresentation } from "./PatientPresentation";
import { DecisionPanel } from "./DecisionPanel";
import { FeedbackDisplay } from "./FeedbackDisplay";
import { ScoreTracker } from "./ScoreTracker";
import { StageProgress } from "./StageProgress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

interface SimulatorPlayerProps {
    medicalCase: CaseWithStagesAndOptions;
}

export function SimulatorPlayer({ medicalCase }: SimulatorPlayerProps) {
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showingFeedback, setShowingFeedback] = useState(false);
    const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const { width, height } = useWindowSize();

    const currentStage = medicalCase.stages[currentStageIndex];

    const handleOptionSelect = (optionId: number) => {
        const option = currentStage.options.find(o => o.id === optionId);
        if (!option) return;

        setScore(prev => prev + option.scoreWeight);
        setSelectedOptionId(optionId);
        setShowingFeedback(true);
    };

    const handleNextStage = () => {
        setShowingFeedback(false);
        setSelectedOptionId(null);

        if (currentStageIndex < medicalCase.stages.length - 1) {
            setCurrentStageIndex(prev => prev + 1);
        } else {
            setIsComplete(true);
        }
    };

    const handleRestart = () => {
        setCurrentStageIndex(0);
        setScore(0);
        setShowingFeedback(false);
        setSelectedOptionId(null);
        setIsComplete(false);
    };

    if (isComplete) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-8">
                {score > 0 && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-card border rounded-xl p-12 shadow-lg"
                >
                    <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                        <Trophy className="w-12 h-12 text-primary" />
                    </div>

                    <h2 className="text-3xl font-bold mb-2">Case Completed!</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        You have finished the simulation for "{medicalCase.title}"
                    </p>

                    <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-6 mb-8 max-w-xs mx-auto">
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Final Score</span>
                        <span className={`text-5xl font-bold font-mono ${score >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {score}
                        </span>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <Link href="/cases">
                            <Button variant="outline" size="lg">Exit to Cases</Button>
                        </Link>
                        <Button onClick={handleRestart} size="lg" className="gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Play Again
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!currentStage) {
        return (
            <div className="p-12 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h3 className="text-xl font-bold">Error Loading Stage</h3>
                <p className="text-muted-foreground">The case data seems to be incomplete.</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Reload Page</Button>
            </div>
        );
    }

    const selectedOption = currentStage.options.find(o => o.id === selectedOptionId);

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-8 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b">
                <div>
                    <h1 className="text-xl font-bold truncate max-w-[200px] md:max-w-md">
                        {medicalCase.title}
                    </h1>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                            {medicalCase.difficultyLevel}
                        </span>
                        <span>•</span>
                        <span>{medicalCase.clinicalDomain}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Current Score</div>
                        <ScoreTracker score={score} />
                    </div>
                    <div className="w-[120px]">
                        <StageProgress
                            currentStageIndex={currentStageIndex}
                            totalStages={medicalCase.stages.length}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Patient Presentation (Left/Top) */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStage.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="p-6 border-l-4 border-l-primary shadow-sm">
                                <PatientPresentation stage={currentStage as any} />
                            </Card>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Interaction Area (Right/Bottom) */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        {showingFeedback && selectedOption ? (
                            <motion.div
                                key="feedback"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <FeedbackDisplay
                                    selectedOption={selectedOption as any}
                                    onContinue={handleNextStage}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="decision"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <Card className="p-6">
                                    <DecisionPanel
                                        options={currentStage.options}
                                        onSelectOption={handleOptionSelect}
                                        disabled={showingFeedback}
                                    />
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
