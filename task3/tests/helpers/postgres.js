import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

async function getFreePort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/**
 * Start a real PostgreSQL server in a temporary directory. This lets the test
 * suite exercise actual Postgres SQL and a real stop/start without requiring
 * Docker on the machine running the tests.
 */
export async function startPostgres() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task3-postgres-'));
  const port = await getFreePort();

  const server = new EmbeddedPostgres({
    databaseDir: directory,
    user: 'postgres',
    password: 'dev',
    port,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });

  await server.initialise();
  await server.start();
  await server.createDatabase('tasks_test');

  let running = true;

  return {
    connectionString: `postgres://postgres:dev@127.0.0.1:${port}/tasks_test`,

    async stop() {
      if (!running) return;
      await server.stop();
      running = false;
    },

    async start() {
      if (running) return;
      await server.start();
      running = true;
    },

    async cleanup() {
      if (running) await server.stop();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
