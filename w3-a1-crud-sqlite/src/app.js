import express from 'express';
import { createTasksRepository } from './tasks-repo.js';

/**
 * Build the Express app around an already-open database. Taking the database
 * as an argument keeps the app easy to test with a temporary database.
 */
export function createApp(db) {
  const app = express();
  const tasks = createTasksRepository(db);

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // GET /tasks - list every task
  app.get('/tasks', (req, res) => {
    res.json(tasks.list());
  });

  // GET /tasks/:id - return one task or 404
  app.get('/tasks/:id', (req, res) => {
    const id = parseId(req.params.id);
    const task = id === null ? null : tasks.getById(id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  });

  // Unknown routes still return JSON instead of an HTML error page.
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Central error handler for malformed JSON and unexpected failures.
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/** Parse a positive integer id, returning null for anything else. */
export function parseId(rawId) {
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) return null;

  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
