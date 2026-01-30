import { relations } from 'drizzle-orm';
import {
    pgTable,
    serial,
    text,
    timestamp,
    boolean,
    integer,
    jsonb,
    index,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS (Type-safe string literals)
// ============================================================================

export const userRoles = ['student', 'admin'] as const;
export type UserRole = typeof userRoles[number];

export const difficultyLevels = ['Foundation', 'Core', 'Advanced'] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

// ============================================================================
// TABLE: users
// ============================================================================

export const users = pgTable('users', {
    id: text('id').primaryKey(), // Clerk User ID
    email: text('email').notNull(),
    role: text('role', { enum: userRoles }).default('student').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// TABLE: cases (Medical Scenarios)
// ============================================================================

export const cases = pgTable('cases', {
    id: serial('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }), // Owner of the case
    title: text('title').notNull(),
    description: text('description').notNull(),
    clinicalDomain: text('clinical_domain').notNull(), // e.g., "Cardiology", "Respiratory"
    difficultyLevel: text('difficulty_level', { enum: difficultyLevels }).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// TABLE: case_stages (Time-based Steps within a Case)
// ============================================================================

export const caseStages = pgTable(
    'case_stages',
    {
        id: serial('id').primaryKey(),
        caseId: integer('case_id')
            .notNull()
            .references(() => cases.id, { onDelete: 'cascade' }),
        stageOrder: integer('stage_order').notNull(), // Sequence the events (1, 2, 3...)
        narrative: text('narrative').notNull(), // Main scenario text
        clinicalData: jsonb('clinical_data'), // Flexible vitals: { "BP": "120/80", "HR": 99 }
        mediaUrl: text('media_url'), // Optional: X-rays, ECG images, etc.
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        // Index on case_id for fast lookups when querying stages by case
        caseIdIdx: index('case_stages_case_id_idx').on(table.caseId),
    })
);

// ============================================================================
// TABLE: stage_options (Decision Points for each Stage)
// ============================================================================

export const stageOptions = pgTable(
    'stage_options',
    {
        id: serial('id').primaryKey(),
        stageId: integer('stage_id')
            .notNull()
            .references(() => caseStages.id, { onDelete: 'cascade' }),
        text: text('text').notNull(), // The choice text (e.g., "Administer 5mg Morphine")
        isCorrect: boolean('is_correct').notNull().default(false),
        scoreWeight: integer('score_weight').notNull().default(0), // +2 optimal, +1 safe, -5 fatal, etc.
        feedback: text('feedback').notNull(), // Immediate explanation after selecting
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        // Index on stage_id for fast lookups when querying options by stage
        stageIdIdx: index('stage_options_stage_id_idx').on(table.stageId),
    })
);

// ============================================================================
// RELATIONS (For Nested Queries)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
    cases: many(cases), // User's created cases
    // Future: user progress, attempt history, etc.
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
    user: one(users, {
        fields: [cases.userId],
        references: [users.id],
    }),
    stages: many(caseStages),
}));

export const caseStagesRelations = relations(caseStages, ({ one, many }) => ({
    case: one(cases, {
        fields: [caseStages.caseId],
        references: [cases.id],
    }),
    options: many(stageOptions),
}));

export const stageOptionsRelations = relations(stageOptions, ({ one }) => ({
    stage: one(caseStages, {
        fields: [stageOptions.stageId],
        references: [caseStages.id],
    }),
}));

// ============================================================================
// TYPE EXPORTS (For use in application code)
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;

export type CaseStage = typeof caseStages.$inferSelect;
export type NewCaseStage = typeof caseStages.$inferInsert;

export type StageOption = typeof stageOptions.$inferSelect;
export type NewStageOption = typeof stageOptions.$inferInsert;

// ============================================================================
// CLINICAL DATA TYPE (For the JSONB field)
// ============================================================================

export interface ClinicalData {
    // Vital Signs
    BP?: string; // Blood Pressure (e.g., "120/80")
    HR?: number; // Heart Rate
    RR?: number; // Respiratory Rate
    Temp?: number; // Temperature
    SpO2?: number; // Oxygen Saturation

    // Additional structured data
    labs?: Record<string, string | number>;
    notes?: string[];

    // Flexible for any other data
    [key: string]: any;
}
