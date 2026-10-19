import fs from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

/**
 * Every SQL statement in the application lives in this file. The API layer
 * receives a repository object and never imports `pg` itself.
 */

const SCHEMA_SQL = fs.readFileSync(
  new URL('../sql/schema.sql', import.meta.url),
  'utf8'
);

const SEED_TASKS = [
  ['Buy milk', false],
  ['Walk the dog', false],
  ['Finish the FlyRank assignment', true],
];

export function createPool({
  connectionString = process.env.DATABASE_URL,
  ssl,
} = {}) {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env or pass a connection string.'
    );
  }

  const useSsl =
    ssl ?? (process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined);

  const pool = new Pool({
    connectionString,
    ssl: useSsl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error.message);
  });

  return pool;
}

/** Create the tasks and app_meta tables when they do not exist. */
export async function migrate(pool) {
  await pool.query(SCHEMA_SQL);
}

/**
 * Insert the three examples once in the lifetime of the database.
 *
 * The transaction + advisory lock make this safe if two containers start at
 * the same time. app_meta is the "seeded" marker: an empty tasks table alone is
 * not enough, because a user may deliberately delete every task.
 */
export async function seed(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('tasks_seed'))");

    const marker = await client.query(
      "SELECT value FROM app_meta WHERE key = 'seeded'"
    );

    if (marker.rowCount === 0) {
      const { rows } = await client.query(
        'SELECT COUNT(*)::int AS count FROM tasks'
      );

      if (rows[0].count === 0) {
        const values = SEED_TASKS.flat();
        await client.query(
          `INSERT INTO tasks (title, done)
           VALUES ($1, $2), ($3, $4), ($5, $6)`,
          values
        );
      }

      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('seeded', '1') ON CONFLICT (key) DO NOTHING"
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Build the Postgres-backed repository that the routes receive. */
export async function createTasksRepository({
  connectionString = process.env.DATABASE_URL,
  ssl,
  pool: providedPool,
} = {}) {
  const pool = providedPool ?? createPool({ connectionString, ssl });

  await migrate(pool);
  await seed(pool);

  return {
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },

    async close() {
      await pool.end();
    },
  };
}
