import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

interface StageProgressProps {
    currentStageIndex: number;
    totalStages: number;
}

export function StageProgress({ currentStageIndex, totalStages }: StageProgressProps) {
    const progressPercentage = ((currentStageIndex + 1) / totalStages) * 100;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
                <span>Stage {currentStageIndex + 1} of {totalStages}</span>
                <span>{Math.round(progressPercentage)}% Complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />

            <div className="flex justify-between mt-2 px-1">
                {Array.from({ length: totalStages }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                        {idx < currentStageIndex ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : idx === currentStageIndex ? (
                            <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
                        ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
