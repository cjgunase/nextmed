import { z } from 'zod';

/**
 * Validator for the current state of the simulator
 */
export const simulatorStateSchema = z.object({
    caseId: z.number(),
    currentStageIndex: z.number().min(0),
    score: z.number(),
    isComplete: z.boolean(),
    // Map is not directly serializable to JSON, so we use an array of tuples or object for transmission
    selectedOptions: z.record(z.string(), z.number()), // stageId -> optionId
});

/**
 * Validator for submitting a clinical decision
 */
export const submitDecisionSchema = z.object({
    caseId: z.number(),
    stageId: z.number(),
    optionId: z.number(),
    currentScore: z.number(),
});

export type SimulatorState = z.infer<typeof simulatorStateSchema>;
export type SubmitDecisionInput = z.infer<typeof submitDecisionSchema>;
