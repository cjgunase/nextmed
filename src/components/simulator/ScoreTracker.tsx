import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface ScoreTrackerProps {
    score: number;
}

export function ScoreTracker({ score }: ScoreTrackerProps) {
    const prevScoreRef = useRef(score);
    const [difference, setDifference] = useState(0);
    const [showDiff, setShowDiff] = useState(false);

    useEffect(() => {
        if (score === prevScoreRef.current) return;

        const diff = score - prevScoreRef.current;
        prevScoreRef.current = score;

        const showTimer = setTimeout(() => {
            setDifference(diff);
            setShowDiff(true);
        }, 0);
        const hideTimer = setTimeout(() => {
            setShowDiff(false);
        }, 2000);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [score]);

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
