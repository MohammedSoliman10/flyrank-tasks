-- Optional stretch: measure the cost of filtering on `done`.
--
-- Run with psql against a scratch copy of the database:
--   docker compose exec -T db psql -U postgres -d tasks < sql/explain.sql
--
-- 100,000 rows are inserted, of which only 100 are completed. That makes the
-- difference between a sequential scan and an index scan easy to see.

DROP TABLE IF EXISTS tasks_bench;

CREATE TABLE tasks_bench (
  id         SERIAL PRIMARY KEY,
  title      TEXT        NOT NULL,
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tasks_bench (title, done)
SELECT 'task ' || g, (g % 1000 = 0)
FROM generate_series(1, 100000) AS g;

ANALYZE tasks_bench;

-- BEFORE: no index on done (sequential scan over 100,000 rows).
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT * FROM tasks_bench WHERE done = TRUE;

CREATE INDEX idx_tasks_bench_done ON tasks_bench (done);
ANALYZE tasks_bench;

-- AFTER: the index is used (bitmap index scan).
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT * FROM tasks_bench WHERE done = TRUE;

DROP TABLE tasks_bench;
