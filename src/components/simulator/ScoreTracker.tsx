import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface ScoreTrackerProps {
    score: number;
}

export function ScoreTracker({ score }: ScoreTrackerProps) {
    const [prevScore, setPrevScore] = useState(score);
    const [difference, setDifference] = useState(0);
    const [showDiff, setShowDiff] = useState(false);

    useEffect(() => {
        if (score !== prevScore) {
            setDifference(score - prevScore);
            setShowDiff(true);
            const timer = setTimeout(() => {
                setShowDiff(false);
                setPrevScore(score);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [score, prevScore]);

    return (
        <div className="relative inline-flex items-center justify-center min-w-[3rem]">
            <span className="text-2xl font-bold font-mono">{score}</span>

            {showDiff && (
                <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -20 }}
                    exit={{ opacity: 0 }}
                    className={`absolute text-sm font-bold ${difference > 0 ? 'text-green-500' : difference < 0 ? 'text-red-500' : 'text-slate-500'}`}
                >
                    {difference > 0 ? '+' : ''}{difference}
                </motion.span>
            )}
        </div>
    );
}
