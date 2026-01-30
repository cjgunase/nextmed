import { z } from 'zod';
import { difficultyLevels } from '@/db/schema';

// ============================================================================
// CASE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new case
 */
export const createCaseSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
    clinicalDomain: z.string().min(1, 'Clinical domain is required'),
    difficultyLevel: z.enum(difficultyLevels),
    isPublished: z.boolean().default(false),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

/**
 * Schema for updating an existing case
 */
export const updateCaseSchema = z.object({
    id: z.number().int().positive('Invalid case ID'),
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(10).max(2000).optional(),
    clinicalDomain: z.string().min(1).optional(),
    difficultyLevel: z.enum(difficultyLevels).optional(),
    isPublished: z.boolean().optional(),
});

export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

/**
 * Schema for case ID parameter validation
 */
export const caseIdSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Case ID must be a number').transform(Number),
});

export type CaseIdInput = z.infer<typeof caseIdSchema>;

/**
 * Schema for publishing/unpublishing a case
 */
export const togglePublishSchema = z.object({
    id: z.number().int().positive('Invalid case ID'),
    isPublished: z.boolean(),
});

export type TogglePublishInput = z.infer<typeof togglePublishSchema>;

// ============================================================================
// CASE STAGE SCHEMAS
// ============================================================================

/**
 * Schema for creating a case stage
 */
export const createCaseStageSchema = z.object({
    caseId: z.number().int().positive('Invalid case ID'),
    stageOrder: z.number().int().positive('Stage order must be positive'),
    narrative: z.string().min(10, 'Narrative must be at least 10 characters'),
    clinicalData: z.record(z.any()).optional(),
    mediaUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
});

export type CreateCaseStageInput = z.infer<typeof createCaseStageSchema>;

/**
 * Schema for updating a case stage
 */
export const updateCaseStageSchema = z.object({
    id: z.number().int().positive('Invalid stage ID'),
    stageOrder: z.number().int().positive().optional(),
    narrative: z.string().min(10).optional(),
    clinicalData: z.record(z.any()).optional(),
    mediaUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
});

export type UpdateCaseStageInput = z.infer<typeof updateCaseStageSchema>;

// ============================================================================
// STAGE OPTION SCHEMAS
// ============================================================================

/**
 * Schema for creating a stage option
 */
export const createStageOptionSchema = z.object({
    stageId: z.number().int().positive('Invalid stage ID'),
    text: z.string().min(1, 'Option text is required').max(500),
    isCorrect: z.boolean().default(false),
    scoreWeight: z.number().int().default(0),
    feedback: z.string().min(1, 'Feedback is required').max(1000),
});

export type CreateStageOptionInput = z.infer<typeof createStageOptionSchema>;

/**
 * Schema for updating a stage option
 */
export const updateStageOptionSchema = z.object({
    id: z.number().int().positive('Invalid option ID'),
    text: z.string().min(1).max(500).optional(),
    isCorrect: z.boolean().optional(),
    scoreWeight: z.number().int().optional(),
    feedback: z.string().min(1).max(1000).optional(),
});

export type UpdateStageOptionInput = z.infer<typeof updateStageOptionSchema>;
