ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "rivision_cluster_key" text;
ALTER TABLE "ukmla_questions" ADD COLUMN IF NOT EXISTS "rivision_cluster_key" text;

CREATE TABLE IF NOT EXISTS "rivision_note_taxonomy" (
  "id" serial PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "cluster_key" text NOT NULL,
  "cluster_label" text NOT NULL,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rivision_context_clusters" (
  "id" serial PRIMARY KEY NOT NULL,
  "context_type" text NOT NULL,
  "context_id" text NOT NULL,
  "domain" text NOT NULL,
  "difficulty_level" text,
  "cluster_key" text NOT NULL,
  "matched_by" text DEFAULT 'heuristic' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rivision_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "domain" text NOT NULL,
  "difficulty_level" text,
  "cluster_key" text,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "key_concepts" jsonb NOT NULL,
  "common_mistakes" jsonb NOT NULL,
  "rapid_checklist" jsonb NOT NULL,
  "practice_plan" jsonb NOT NULL,
  "source_version" text NOT NULL,
  "performance_snapshot" jsonb NOT NULL,
  "stale_at" timestamp,
  "last_generated_at" timestamp DEFAULT now() NOT NULL,
  "last_served_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rivision_note_evidence" (
  "id" serial PRIMARY KEY NOT NULL,
  "note_id" integer NOT NULL REFERENCES "rivision_notes"("id") ON DELETE CASCADE,
  "source_type" text NOT NULL,
  "source_id" integer NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "rivision_taxonomy_domain_idx" ON "rivision_note_taxonomy" ("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "rivision_taxonomy_domain_cluster_uq" ON "rivision_note_taxonomy" ("domain", "cluster_key");

CREATE UNIQUE INDEX IF NOT EXISTS "rivision_context_cache_uq" ON "rivision_context_clusters" ("context_type", "context_id");
CREATE INDEX IF NOT EXISTS "rivision_context_domain_idx" ON "rivision_context_clusters" ("domain");

CREATE INDEX IF NOT EXISTS "rivision_notes_user_idx" ON "rivision_notes" ("user_id");
CREATE INDEX IF NOT EXISTS "rivision_notes_domain_idx" ON "rivision_notes" ("domain");
CREATE INDEX IF NOT EXISTS "rivision_notes_stale_idx" ON "rivision_notes" ("stale_at");

CREATE UNIQUE INDEX IF NOT EXISTS "rivision_notes_scope_uq" 
ON "rivision_notes" ("user_id", "domain", COALESCE("difficulty_level", '__all__'), COALESCE("cluster_key", '__all__'));

CREATE INDEX IF NOT EXISTS "rivision_note_evidence_note_idx" ON "rivision_note_evidence" ("note_id");
