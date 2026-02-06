import { z } from 'zod';
import { difficultyLevels } from '@/db/schema';

export const generateRivisionMaterialSchema = z.object({
    category: z.string().trim().min(2).max(80),
});

export const rivisionContextTypeSchema = z.enum(['ukmla_question', 'case', 'category']);

export const rivisionNoteSchema = z.object({
    title: z.string().min(5).max(200),
    summary: z.string().min(20).max(2000),
    keyConcepts: z.array(z.string().min(3).max(240)).min(3).max(8),
    commonMistakes: z.array(z.string().min(3).max(240)).min(2).max(8),
    rapidChecklist: z.array(z.string().min(3).max(240)).min(3).max(10),
    practicePlan: z.array(z.string().min(3).max(240)).min(3).max(8),
});

export const getRivisionNoteSchema = z.object({
    contextType: rivisionContextTypeSchema,
    contextId: z.union([z.number().int().positive(), z.string().trim().min(1).max(200)]),
    forceRefresh: z.boolean().optional().default(false),
});

export const refreshRivisionNoteSchema = z.object({
    domain: z.string().trim().min(2).max(80),
    difficulty: z.enum(difficultyLevels).optional(),
    clusterKey: z.string().trim().min(2).max(120).optional(),
    sourceVersionOverride: z.string().trim().min(3).max(120).optional(),
});

export const rivisionNoteKeySchema = z.object({
    domain: z.string().trim().min(2).max(80),
    difficulty: z.enum(difficultyLevels).nullable(),
    clusterKey: z.string().trim().min(2).max(120).nullable(),
});

export type GenerateRivisionMaterialInput = z.infer<typeof generateRivisionMaterialSchema>;
export type RivisionNote = z.infer<typeof rivisionNoteSchema>;
export type RivisionContextType = z.infer<typeof rivisionContextTypeSchema>;
export type GetRivisionNoteInput = z.input<typeof getRivisionNoteSchema>;
export type RefreshRivisionNoteInput = z.input<typeof refreshRivisionNoteSchema>;
export type RivisionNoteKey = z.infer<typeof rivisionNoteKeySchema>;
