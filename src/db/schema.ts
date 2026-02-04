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
    firstName: text('first_name'),
    lastName: text('last_name'),
    imageUrl: text('image_url'),
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
    source: text('source').default('human').notNull(), // 'human' or 'ai'
    verificationStatus: text('verification_status').default('draft').notNull(), // 'draft', 'verified', 'rejected'
    qualityScore: integer('quality_score').default(0).notNull(), // 0-100 score
    rigourScore: integer('rigour_score').default(0).notNull(), // 0-100 human expert quality assessment
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
// TABLE: student_attempts (Track Student Case Completions)
// ============================================================================

export const studentAttempts = pgTable(
    'student_attempts',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        caseId: integer('case_id')
            .notNull()
            .references(() => cases.id, { onDelete: 'cascade' }),
        score: integer('score').notNull().default(0),
        completedAt: timestamp('completed_at').defaultNow().notNull(),
    },
    (table) => ({
        // Index for fast lookups by user and case
        userIdIdx: index('student_attempts_user_id_idx').on(table.userId),
        caseIdIdx: index('student_attempts_case_id_idx').on(table.caseId),
    })
);

// ============================================================================
// TABLE: user_stats (Aggregated Student Performance for Leaderboard)
// ============================================================================

export const userStats = pgTable('user_stats', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    totalAttempts: integer('total_attempts').notNull().default(0),
    totalScore: integer('total_score').notNull().default(0),
    averageScore: integer('average_score').notNull().default(0), // Stored as integer for simplicity
    lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
});

// ============================================================================
// TABLE: category_stats (Performance by Clinical Domain)
// ============================================================================

export const categoryStats = pgTable(
    'category_stats',
    {
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        clinicalDomain: text('clinical_domain').notNull(),
        totalAttempts: integer('total_attempts').notNull().default(0),
        totalScore: integer('total_score').notNull().default(0),
        averageScore: integer('average_score').notNull().default(0),
        lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
    },
    (table) => ({
        pk: index('category_stats_pk').on(table.userId, table.clinicalDomain),
        userIdIdx: index('category_stats_user_id_idx').on(table.userId),
    })
);

// ============================================================================
// TABLE: difficulty_stats (Performance by Difficulty Level)
// ============================================================================

export const difficultyStats = pgTable(
    'difficulty_stats',
    {
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        difficultyLevel: text('difficulty_level', { enum: difficultyLevels }).notNull(),
        totalAttempts: integer('total_attempts').notNull().default(0),
        totalScore: integer('total_score').notNull().default(0),
        averageScore: integer('average_score').notNull().default(0),
        lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
    },
    (table) => ({
        pk: index('difficulty_stats_pk').on(table.userId, table.difficultyLevel),
        userIdIdx: index('difficulty_stats_user_id_idx').on(table.userId),
    })
);

// ============================================================================
// TABLE: spaced_repetition_cards (Card Review Scheduling)
// ============================================================================

export const spacedRepetitionCards = pgTable(
    'spaced_repetition_cards',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        caseId: integer('case_id')
            .notNull()
            .references(() => cases.id, { onDelete: 'cascade' }),
        repetitions: integer('repetitions').notNull().default(0), // Number of successful reviews
        easeFactor: integer('ease_factor').notNull().default(2500), // Stored as 2.5 * 1000 for precision
        interval: integer('interval').notNull().default(1), // Days until next review
        nextReviewDate: timestamp('next_review_date').notNull().defaultNow(),
        lastReviewedAt: timestamp('last_reviewed_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => ({
        userCaseIdx: index('sr_cards_user_case_idx').on(table.userId, table.caseId),
        nextReviewIdx: index('sr_cards_next_review_idx').on(table.nextReviewDate),
        userIdIdx: index('sr_cards_user_id_idx').on(table.userId),
    })
);


// ============================================================================
// RELATIONS (For Nested Queries)
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
    cases: many(cases), // User's created cases
    attempts: many(studentAttempts), // Student's case attempts
    stats: one(userStats, {
        fields: [users.id],
        references: [userStats.userId],
    }),
    categoryStats: many(categoryStats),
    difficultyStats: many(difficultyStats),
    spacedRepetitionCards: many(spacedRepetitionCards),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
    user: one(users, {
        fields: [cases.userId],
        references: [users.id],
    }),
    stages: many(caseStages),
    attempts: many(studentAttempts), // Track who attempted this case
    spacedRepetitionCards: many(spacedRepetitionCards),
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

export const studentAttemptsRelations = relations(studentAttempts, ({ one }) => ({
    user: one(users, {
        fields: [studentAttempts.userId],
        references: [users.id],
    }),
    case: one(cases, {
        fields: [studentAttempts.caseId],
        references: [cases.id],
    }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
    user: one(users, {
        fields: [userStats.userId],
        references: [users.id],
    }),
}));

export const categoryStatsRelations = relations(categoryStats, ({ one }) => ({
    user: one(users, {
        fields: [categoryStats.userId],
        references: [users.id],
    }),
}));

export const difficultyStatsRelations = relations(difficultyStats, ({ one }) => ({
    user: one(users, {
        fields: [difficultyStats.userId],
        references: [users.id],
    }),
}));

export const spacedRepetitionCardsRelations = relations(spacedRepetitionCards, ({ one }) => ({
    user: one(users, {
        fields: [spacedRepetitionCards.userId],
        references: [users.id],
    }),
    case: one(cases, {
        fields: [spacedRepetitionCards.caseId],
        references: [cases.id],
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

export type StudentAttempt = typeof studentAttempts.$inferSelect;
export type NewStudentAttempt = typeof studentAttempts.$inferInsert;

export type UserStats = typeof userStats.$inferSelect;
export type NewUserStats = typeof userStats.$inferInsert;

export type CategoryStats = typeof categoryStats.$inferSelect;
export type NewCategoryStats = typeof categoryStats.$inferInsert;

export type DifficultyStats = typeof difficultyStats.$inferSelect;
export type NewDifficultyStats = typeof difficultyStats.$inferInsert;

export type SpacedRepetitionCard = typeof spacedRepetitionCards.$inferSelect;
export type NewSpacedRepetitionCard = typeof spacedRepetitionCards.$inferInsert;


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
