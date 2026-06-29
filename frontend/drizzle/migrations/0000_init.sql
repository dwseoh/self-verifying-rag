CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text,
  "email" text NOT NULL UNIQUE,
  "email_verified" timestamp,
  "image" text,
  "password_hash" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  PRIMARY KEY ("provider", "provider_account_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "session_token" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "expires" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

CREATE TABLE IF NOT EXISTS "repositories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "source" text NOT NULL,
  "local_path" text,
  "github_owner" text,
  "github_repo" text,
  "github_full_name" text,
  "github_installation_id" integer,
  "default_branch" text DEFAULT 'main' NOT NULL,
  "webhook_id" integer,
  "connected_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "repository_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "trigger" text NOT NULL,
  "scope_mode" text NOT NULL,
  "base_ref" text,
  "head_ref" text,
  "status" text NOT NULL,
  "risk_level" text,
  "findings_count" integer DEFAULT 0,
  "pr_number" integer,
  "pr_url" text,
  "result" jsonb,
  "error" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "cerebras_api_key" text,
  "backend_url" text
);

CREATE INDEX IF NOT EXISTS "repositories_user_id_idx" ON "repositories" ("user_id");
CREATE INDEX IF NOT EXISTS "verification_runs_repository_id_idx" ON "verification_runs" ("repository_id");
CREATE INDEX IF NOT EXISTS "verification_runs_user_id_idx" ON "verification_runs" ("user_id");
