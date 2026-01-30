CREATE TABLE "case_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"stage_order" integer NOT NULL,
	"narrative" text NOT NULL,
	"clinical_data" jsonb,
	"media_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"clinical_domain" text NOT NULL,
	"difficulty_level" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"score_weight" integer DEFAULT 0 NOT NULL,
	"feedback" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_stages" ADD CONSTRAINT "case_stages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_options" ADD CONSTRAINT "stage_options_stage_id_case_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."case_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_stages_case_id_idx" ON "case_stages" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "stage_options_stage_id_idx" ON "stage_options" USING btree ("stage_id");