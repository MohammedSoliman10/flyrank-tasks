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

  // POST /tasks - create a task
  app.post('/tasks', (req, res) => {
    const { title, done } = req.body ?? {};

    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (done !== undefined && typeof done !== 'boolean') {
      return res.status(400).json({ error: 'Done must be a boolean' });
    }

    const task = tasks.create({ title: title.trim(), done: done ?? false });

    res
      .status(201)
      .location(`/tasks/${task.id}`)
      .json(task);
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

  // PUT /tasks/:id - replace/update a task (PATCH is accepted too)
  const updateTask = (req, res) => {
    const id = parseId(req.params.id);

    if (id === null || !tasks.getById(id)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const parsed = parseTaskUpdate(req.body);

    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const task = tasks.update(id, parsed.changes);
    res.json(task);
  };

  app.put('/tasks/:id', updateTask);
  app.patch('/tasks/:id', updateTask);

  // DELETE /tasks/:id - remove a task
  app.delete('/tasks/:id', (req, res) => {
    const id = parseId(req.params.id);

    if (id === null || !tasks.remove(id)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).end();
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

/** Validate a PUT/PATCH body and normalise the fields that were provided. */
function parseTaskUpdate(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid request body' };
  }

  const { title, done } = body;

  if (title === undefined && done === undefined) {
    return { error: 'Provide at least one of title or done' };
  }

  if (
    title !== undefined &&
    (typeof title !== 'string' || title.trim() === '')
  ) {
    return { error: 'Title is required' };
  }

  if (done !== undefined && typeof done !== 'boolean') {
    return { error: 'Done must be a boolean' };
  }

  const changes = {};
  if (title !== undefined) changes.title = title.trim();
  if (done !== undefined) changes.done = done;

  return { changes };
}
