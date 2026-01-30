import { pgTable, text, timestamp, foreignKey, serial, boolean, index, integer, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	role: text().default('student').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const cases = pgTable("cases", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	clinicalDomain: text("clinical_domain").notNull(),
	difficultyLevel: text("difficulty_level").notNull(),
	isPublished: boolean("is_published").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cases_user_id_fkey"
		}).onDelete("cascade"),
]);

export const caseStages = pgTable("case_stages", {
	id: serial().primaryKey().notNull(),
	caseId: integer("case_id").notNull(),
	stageOrder: integer("stage_order").notNull(),
	narrative: text().notNull(),
	clinicalData: jsonb("clinical_data"),
	mediaUrl: text("media_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("case_stages_case_id_idx").using("btree", table.caseId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [cases.id],
			name: "case_stages_case_id_fkey"
		}).onDelete("cascade"),
]);

export const stageOptions = pgTable("stage_options", {
	id: serial().primaryKey().notNull(),
	stageId: integer("stage_id").notNull(),
	text: text().notNull(),
	isCorrect: boolean("is_correct").default(false).notNull(),
	scoreWeight: integer("score_weight").default(0).notNull(),
	feedback: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("stage_options_stage_id_idx").using("btree", table.stageId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stageId],
			foreignColumns: [caseStages.id],
			name: "stage_options_stage_id_fkey"
		}).onDelete("cascade"),
]);
