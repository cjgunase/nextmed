import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface FeedbackDisplayProps {
    selectedOption: {
        id: number;
        text: string;
        isCorrect: boolean;
        scoreWeight: number;
        feedback: string;
    };
    onContinue: () => void;
}

export function FeedbackDisplay({ selectedOption, onContinue }: FeedbackDisplayProps) {
    const isGood = selectedOption.scoreWeight > 0;
    const isNeutral = selectedOption.scoreWeight === 0;
    const isBad = selectedOption.scoreWeight < 0;

    // Determine visual style based on score weight, not just isCorrect
    // isCorrect is boolean, but scoreWeight gives nuance (Safe vs Optimal vs Dangerous)
    let variant: "success" | "warning" | "destructive" = "success";
    let Icon = CheckCircle;
    let title = "Excellent Decision";

    if (selectedOption.scoreWeight >= 2) {
        variant = "success";
        Icon = CheckCircle;
        title = "Optimal Choice";
    } else if (selectedOption.scoreWeight > 0) {
        variant = "success";
        Icon = CheckCircle;
        title = "Good Choice";
    } else if (selectedOption.scoreWeight === 0) {
        variant = "warning";
        Icon = AlertTriangle;
        title = "Neutral Choice";
    } else if (selectedOption.scoreWeight >= -2) {
        variant = "warning";
        Icon = AlertTriangle;
        title = "Suboptimal Choice";
    } else {
        variant = "destructive";
        Icon = XCircle;
        title = "Dangerous Choice"; // -5 points
    }

    const colorClasses = {
        success: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
        warning: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
        destructive: "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400",
    };

    const iconColors = {
        success: "text-green-500",
        warning: "text-amber-500",
        destructive: "text-red-500",
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-lg border p-6 ${colorClasses[variant]}`}
        >
            <div className="flex items-start gap-4">
                <Icon className={`h-8 w-8 mt-1 ${iconColors[variant]}`} />
                <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        {title}
                        <span className={`text-sm px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 border font-mono ${iconColors[variant]}`}>
                            {selectedOption.scoreWeight > 0 ? '+' : ''}{selectedOption.scoreWeight} points
                        </span>
                    </h3>

                    <p className="markdown prose dark:prose-invert max-w-none mb-6">
                        {selectedOption.feedback}
                    </p>

                    <Button
                        onClick={onContinue}
                        className="w-full md:w-auto gap-2"
                        size="lg"
                        variant={variant === 'destructive' ? 'destructive' : 'default'}
                    >
                        Continue to Next Stage
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
