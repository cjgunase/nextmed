CREATE TABLE "ukmla_questions" (
  "id" serial PRIMARY KEY NOT NULL,
  "created_by_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stem" text NOT NULL,
  "explanation" text NOT NULL,
  "category" text NOT NULL,
  "difficulty_level" text NOT NULL,
  "source" text DEFAULT 'human' NOT NULL,
  "verification_status" text DEFAULT 'draft' NOT NULL,
  "quality_score" integer DEFAULT 0 NOT NULL,
  "rigour_score" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ukmla_question_options" (
  "id" serial PRIMARY KEY NOT NULL,
  "question_id" integer NOT NULL REFERENCES "ukmla_questions"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "is_correct" boolean DEFAULT false NOT NULL,
  "option_order" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ukmla_attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "question_id" integer NOT NULL REFERENCES "ukmla_questions"("id") ON DELETE CASCADE,
  "selected_option_id" integer NOT NULL REFERENCES "ukmla_question_options"("id") ON DELETE CASCADE,
  "is_correct" boolean NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ukmla_user_stats" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "total_attempts" integer DEFAULT 0 NOT NULL,
  "total_correct" integer DEFAULT 0 NOT NULL,
  "total_score" integer DEFAULT 0 NOT NULL,
  "average_score" integer DEFAULT 0 NOT NULL,
  "last_activity_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ukmla_category_stats" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "total_attempts" integer DEFAULT 0 NOT NULL,
  "total_correct" integer DEFAULT 0 NOT NULL,
  "total_score" integer DEFAULT 0 NOT NULL,
  "average_score" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ukmla_difficulty_stats" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "difficulty_level" text NOT NULL,
  "total_attempts" integer DEFAULT 0 NOT NULL,
  "total_correct" integer DEFAULT 0 NOT NULL,
  "total_score" integer DEFAULT 0 NOT NULL,
  "average_score" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ukmla_spaced_repetition_cards" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "question_id" integer NOT NULL REFERENCES "ukmla_questions"("id") ON DELETE CASCADE,
  "repetitions" integer DEFAULT 0 NOT NULL,
  "ease_factor" integer DEFAULT 2500 NOT NULL,
  "interval" integer DEFAULT 1 NOT NULL,
  "next_review_date" timestamp DEFAULT now() NOT NULL,
  "last_reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "ukmla_questions_creator_idx" ON "ukmla_questions" ("created_by_user_id");
CREATE INDEX "ukmla_questions_category_idx" ON "ukmla_questions" ("category");
CREATE INDEX "ukmla_questions_difficulty_idx" ON "ukmla_questions" ("difficulty_level");
CREATE INDEX "ukmla_questions_published_idx" ON "ukmla_questions" ("is_published");

CREATE INDEX "ukmla_question_options_question_idx" ON "ukmla_question_options" ("question_id");

CREATE INDEX "ukmla_attempts_user_idx" ON "ukmla_attempts" ("user_id");
CREATE INDEX "ukmla_attempts_question_idx" ON "ukmla_attempts" ("question_id");
CREATE INDEX "ukmla_attempts_user_question_idx" ON "ukmla_attempts" ("user_id", "question_id");

CREATE INDEX "ukmla_category_stats_pk" ON "ukmla_category_stats" ("user_id", "category");
CREATE INDEX "ukmla_category_stats_user_idx" ON "ukmla_category_stats" ("user_id");

CREATE INDEX "ukmla_difficulty_stats_pk" ON "ukmla_difficulty_stats" ("user_id", "difficulty_level");
CREATE INDEX "ukmla_difficulty_stats_user_idx" ON "ukmla_difficulty_stats" ("user_id");

CREATE INDEX "ukmla_sr_cards_user_question_idx" ON "ukmla_spaced_repetition_cards" ("user_id", "question_id");
CREATE INDEX "ukmla_sr_cards_due_idx" ON "ukmla_spaced_repetition_cards" ("next_review_date");
CREATE INDEX "ukmla_sr_cards_user_idx" ON "ukmla_spaced_repetition_cards" ("user_id");
