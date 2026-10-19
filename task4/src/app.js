import express from 'express';

export function createApp({ auth }) {
  if (!auth) throw new Error('createApp requires an auth adapter');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
