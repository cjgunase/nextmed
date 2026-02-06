import type { ClinicalData } from "@/db/schema";
import { ClinicalDataDisplay } from "./ClinicalDataDisplay";
import { User } from "lucide-react";

interface PatientPresentationProps {
    stage: {
        narrative: string;
        clinicalData: ClinicalData | null;
        mediaUrl: string | null;
        stageOrder: number;
    };
}

export function PatientPresentation({ stage }: PatientPresentationProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-full shrink-0">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-4 flex-1">
                    <div className="prose dark:prose-invert max-w-none">
                        <p className="text-lg leading-relaxed">
                            {stage.narrative}
                        </p>
                    </div>
                </div>
            </div>

            {stage.clinicalData && (
                <div className="mt-6">
                    <ClinicalDataDisplay data={stage.clinicalData} />
                </div>
            )}

            {stage.mediaUrl && (
                <div className="mt-6 rounded-lg overflow-hidden border">
                    <img
                        src={stage.mediaUrl}
                        alt="Clinical Media"
                        className="w-full h-auto max-h-[400px] object-contain bg-black"
                    />
                </div>
            )}
        </div>
    );
}
