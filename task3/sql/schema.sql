-- Schema for the tasks API.
-- The application executes this file on startup; every statement is idempotent.

CREATE TABLE IF NOT EXISTS tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT        NOT NULL,
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Records that the three example tasks have been inserted, so deleting every
-- task and restarting does not seed them again.
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Optional extra: helps queries that filter by completion status once the table
-- grows. See sql/explain.sql for a before/after measurement.
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks (done);
