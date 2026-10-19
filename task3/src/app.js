import express from 'express';

/**
 * Build the Express app around a tasks repository.
 */
export function createApp(tasks) {
  const app = express();

  app.use(express.json());

  // GET /health - also proves the database connection is alive
  app.get('/health', async (req, res) => {
    try {
      await tasks.ping();
      res.json({ status: 'ok', db: 'ok' });
    } catch (error) {
      res.status(503).json({ status: 'error', db: 'down' });
    }
  });

  // GET /tasks - list every task
  app.get('/tasks', async (req, res) => {
    res.json(await tasks.list());
  });

  // GET /tasks/:id - return one task or 404
  app.get('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const task = id === null ? null : await tasks.getById(id);

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
