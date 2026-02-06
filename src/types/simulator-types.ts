import type { ClinicalData } from "@/db/schema";

export type ActionResponse<T = unknown> = {
    success: boolean;
    message: string;
    data?: T;
};

export type SimulatorState = {
    currentStageIndex: number;
    score: number;
    selectedOptions: Record<number, number>; // stageId -> optionId
    isComplete: boolean;
};

export type CaseWithStagesAndOptions = {
    id: number;
    title: string;
    description: string;
    clinicalDomain: string;
    difficultyLevel: "Foundation" | "Core" | "Advanced";
    stages: {
        id: number;
        stageOrder: number;
        narrative: string;
        clinicalData: ClinicalData | null;
        mediaUrl: string | null;
        options: {
            id: number;
            text: string;
            scoreWeight: number;
            feedback: string;
            isCorrect: boolean;
        }[];
    }[];
};
