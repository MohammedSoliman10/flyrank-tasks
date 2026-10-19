-- Week 3 - Assignment 1
-- Queries executed manually against tasks.db (DB Browser for SQLite or `npm run sql`).
-- Run them one at a time and check the API afterwards to see the changes.

-- 1. List every task.
SELECT * FROM tasks;

-- 2. Show only completed tasks (done is stored as 0 or 1 in SQLite).
SELECT * FROM tasks WHERE done = 1;

-- 3. Count all tasks.
SELECT COUNT(*) AS total_tasks FROM tasks;

-- 4. Mark every task as completed.
UPDATE tasks
   SET done = 1,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- 5. Delete all completed tasks.
DELETE FROM tasks WHERE done = 1;

-- 6. Inspect the table definition (useful when learning the schema).
PRAGMA table_info(tasks);
