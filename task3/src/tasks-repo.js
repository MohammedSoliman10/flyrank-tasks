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

const TASK_COLUMNS = 'id, title, done, created_at, updated_at';

// ORDER BY cannot use $1 placeholders, so map user input through a whitelist.
const SORT_COLUMNS = {
  id: 'id',
  title: 'LOWER(title)',
};

function toTask(row) {
  if (!row) return null;

  return {
    ...row,
    done: Boolean(row.done),
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

/** Escape LIKE wildcards so a search for "50%" matches a literal "50%". */
function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

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

  // An idle client error must not crash the whole API.
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

/**
 * Build the Postgres-backed repository. It implements the same method names
 * and behaviour as the SQLite repository from A2 (and the in-memory store from
 * A1); only this module changed.
 */
export async function createTasksRepository({
  connectionString = process.env.DATABASE_URL,
  ssl,
  pool: providedPool,
} = {}) {
  const pool = providedPool ?? createPool({ connectionString, ssl });

  await migrate(pool);
  await seed(pool);

  return {
    async list({ search, done, sort = 'id', order = 'asc' } = {}) {
      const conditions = [];
      const values = [];

      if (search) {
        values.push(`%${escapeLike(search)}%`);
        conditions.push(`title ILIKE $${values.length} ESCAPE '\\'`);
      }

      if (typeof done === 'boolean') {
        values.push(done);
        conditions.push(`done = $${values.length}`);
      }

      const direction = order === 'desc' ? 'DESC' : 'ASC';
      const orderBy =
        sort === 'title'
          ? `${SORT_COLUMNS.title} ${direction}, id ASC`
          : `${SORT_COLUMNS.id} ${direction}`;

      const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const { rows } = await pool.query(
        `SELECT ${TASK_COLUMNS} FROM tasks ${where} ORDER BY ${orderBy}`,
        values
      );

      return rows.map(toTask);
    },

    async getById(id) {
      const { rows } = await pool.query(
        `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`,
        [id]
      );

      return toTask(rows[0]);
    },

    async create({ title, done = false }) {
      const { rows } = await pool.query(
        `INSERT INTO tasks (title, done)
         VALUES ($1, $2)
         RETURNING ${TASK_COLUMNS}`,
        [title, done]
      );

      return toTask(rows[0]);
    },

    async update(id, changes) {
      const current = await this.getById(id);
      if (!current) return null;

      const { rows } = await pool.query(
        `UPDATE tasks
            SET title = $1,
                done = $2,
                updated_at = NOW()
          WHERE id = $3
          RETURNING ${TASK_COLUMNS}`,
        [changes.title ?? current.title, changes.done ?? current.done, id]
      );

      return toTask(rows[0]);
    },

    async remove(id) {
      const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return result.rowCount > 0;
    },

    async stats() {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE done)::int AS completed
          FROM tasks
      `);

      const { total, completed } = rows[0];
      return { total, completed, pending: total - completed };
    },

    async ping() {
      await pool.query('SELECT 1');
      return true;
    },

    async close() {
      await pool.end();
    },
  };
}
