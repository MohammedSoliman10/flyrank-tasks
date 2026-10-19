import { createApp } from './app.js';
import { createDatabase, DEFAULT_DB_PATH } from './db.js';

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

const db = createDatabase();
const app = createApp(db);

const server = app.listen(port, () => {
  const address = server.address();
  console.log(`Tasks API listening on http://localhost:${address.port}`);
  console.log(`SQLite database: ${DEFAULT_DB_PATH}`);
});

server.on('error', (error) => {
  console.error('Failed to start the server:', error.message);
  db.close();
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received, shutting down...`);

  server.close(() => {
    db.close();
    process.exit(0);
  });

  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
