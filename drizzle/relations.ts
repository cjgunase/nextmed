import { relations } from "drizzle-orm/relations";
import { users, cases, caseStages, stageOptions } from "./schema";

export const casesRelations = relations(cases, ({one, many}) => ({
	user: one(users, {
		fields: [cases.userId],
		references: [users.id]
	}),
	caseStages: many(caseStages),
}));

export const usersRelations = relations(users, ({many}) => ({
	cases: many(cases),
}));

export const caseStagesRelations = relations(caseStages, ({one, many}) => ({
	case: one(cases, {
		fields: [caseStages.caseId],
		references: [cases.id]
	}),
	stageOptions: many(stageOptions),
}));

export const stageOptionsRelations = relations(stageOptions, ({one}) => ({
	caseStage: one(caseStages, {
		fields: [stageOptions.stageId],
		references: [caseStages.id]
	}),
}));