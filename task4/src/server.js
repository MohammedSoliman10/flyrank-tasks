import 'dotenv/config';

import { createApp } from './app.js';
import { createSupabaseAuth } from './supabase.js';

const port = Number(process.env.PORT) || 3000;

let app;
try {
  const auth = createSupabaseAuth();
  app = createApp({ auth });
} catch (error) {
  console.error(`Could not start the API: ${error.message}`);
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`FlyRank Task 4 API listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, closing server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
