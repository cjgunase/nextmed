import { z } from 'zod';
import { difficultyLevels, ukmlaCategories } from '@/db/schema';

export const ukmlaOptionInputSchema = z.object({
    id: z.number().int().positive().optional(),
    text: z.string().min(1, 'Option text is required').max(500),
    isCorrect: z.boolean(),
    optionOrder: z.number().int().positive().optional(),
});

export const createUkmlaOptionSchema = ukmlaOptionInputSchema.omit({ id: true });

export const createUkmlaQuestionSchema = z
    .object({
        stem: z.string().min(10, 'Question stem must be at least 10 characters').max(4000),
        explanation: z.string().min(10, 'Explanation must be at least 10 characters').max(4000),
        category: z.enum(ukmlaCategories),
        difficultyLevel: z.enum(difficultyLevels),
        options: z.array(createUkmlaOptionSchema).min(2).max(8),
    })
    .superRefine((data, ctx) => {
        const correctCount = data.options.filter((opt) => opt.isCorrect).length;
        if (correctCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['options'],
                message: 'Exactly one option must be marked as correct.',
            });
        }
    });

export const updateUkmlaQuestionSchema = z
    .object({
        id: z.number().int().positive(),
        stem: z.string().min(10).max(4000),
        explanation: z.string().min(10).max(4000),
        category: z.enum(ukmlaCategories),
        difficultyLevel: z.enum(difficultyLevels),
        verificationStatus: z.enum(['draft', 'verified', 'rejected']).optional(),
        qualityScore: z.number().int().min(0).max(100).optional(),
        rigourScore: z.number().int().min(0).max(100).optional(),
        isPublished: z.boolean().optional(),
        options: z.array(ukmlaOptionInputSchema).min(2).max(8),
    })
    .superRefine((data, ctx) => {
        const correctCount = data.options.filter((opt) => opt.isCorrect).length;
        if (correctCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['options'],
                message: 'Exactly one option must be marked as correct.',
            });
        }
    });

export const recordUkmlaAttemptSchema = z.object({
    questionId: z.number().int().positive(),
    selectedOptionId: z.number().int().positive(),
});

export const ukmlaQueryFilterSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    category: z.enum(ukmlaCategories).optional(),
    difficulty: z.enum(difficultyLevels).optional(),
    search: z.string().trim().max(200).optional(),
    status: z.enum(['all', 'due']).default('all'),
});

export const generateUkmlaBatchSchema = z.object({
    prompt: z.string().min(10).max(4000),
    category: z.enum(ukmlaCategories),
    difficulty: z.enum(difficultyLevels),
    count: z.number().int().min(1).max(20),
});

export type CreateUkmlaQuestionInput = z.infer<typeof createUkmlaQuestionSchema>;
export type UpdateUkmlaQuestionInput = z.infer<typeof updateUkmlaQuestionSchema>;
export type RecordUkmlaAttemptInput = z.infer<typeof recordUkmlaAttemptSchema>;
export type UkmlaQueryFilterInput = z.infer<typeof ukmlaQueryFilterSchema>;
export type GenerateUkmlaBatchInput = z.infer<typeof generateUkmlaBatchSchema>;
