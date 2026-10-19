import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { createRequireAuth } from './middleware/require-auth.js';
import { openapi } from './openapi.js';
import { createAuthRouter } from './routes/auth.js';
import { createProtectedRouter } from './routes/protected.js';
import { createPublicRouter } from './routes/public.js';

export function createApp({ auth }) {
  if (!auth) throw new Error('createApp requires an auth adapter');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  const requireAuth = createRequireAuth(auth);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter({ auth, requireAuth }));
  app.use('/public', createPublicRouter());
  app.use('/protected', createProtectedRouter({ requireAuth }));

  app.get('/openapi.json', (req, res) => {
    res.status(200).json(openapi);
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      customSiteTitle: 'FlyRank Task 4 - Supabase Auth API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Express 5 forwards JSON parse errors here. Keep the response shape stable.
  app.use((error, req, res, next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    console.error('Unhandled request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
