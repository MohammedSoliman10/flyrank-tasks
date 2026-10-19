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
