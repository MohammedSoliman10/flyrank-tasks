import 'dotenv/config';
import { createApp } from './app.js';
import { createTasksRepository } from './tasks-repo.js';

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

let server;
let repository;
let shuttingDown = false;

/**
 * Compose waits for Postgres to be healthy, but a bare `npm start` can race the
 * database container. Retry for a short while instead of crashing immediately.
 */
async function connectWithRetry() {
  const attempts = Number(process.env.DB_CONNECT_RETRIES ?? 15);
  const delayMs = Number(process.env.DB_CONNECT_DELAY_MS ?? 1500);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await createTasksRepository();
    } catch (error) {
      if (attempt === attempts) throw error;

      console.warn(
        `Database not ready (attempt ${attempt}/${attempts}): ${error.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  repository = await connectWithRetry();

  const app = createApp(repository);
  server = app.listen(port, () => {
    console.log(`Tasks API listening on http://localhost:${port}`);
    console.log('PostgreSQL repository connected');
  });

  server.on('error', async (error) => {
    console.error('Failed to start the server:', error.message);
    await repository.close();
    process.exit(1);
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received, shutting down...`);

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  if (!server) {
    await repository?.close();
    process.exit(0);
  }

  server.close(async () => {
    try {
      await repository?.close();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((error) => {
  console.error('Failed to start the API:', error.message);
  process.exit(1);
});
