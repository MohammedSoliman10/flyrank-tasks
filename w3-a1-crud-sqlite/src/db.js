import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * The database lives next to package.json, so the project can be started from
 * any working directory. Override it with the DB_PATH environment variable.
 */
export const DEFAULT_DB_PATH =
  process.env.DB_PATH || path.resolve(currentDir, '..', 'tasks.db');

const SEED_TASKS = [
  { title: 'Buy milk', done: 0 },
  { title: 'Walk the dog', done: 0 },
  { title: 'Finish the FlyRank assignment', done: 1 },
];

/**
 * Create (if needed) and open the SQLite database.
 *
 * SQLite creates the file on first open, so there is no separate database
 * server to install or start.
 */
export function createDatabase(filename = DEFAULT_DB_PATH) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const db = new Database(filename);

  // WAL lets reads continue while a write is in progress. The foreign_keys
  // pragma is enabled here as a safe default for future tables.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  seed(db);

  return db;
}

/**
 * Create the schema when it is missing. Keeping this idempotent means every
 * start is safe: the table is only created the first time.
 */
export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/**
 * Insert the three example tasks only once in the lifetime of the database.
 *
 * The app_meta marker is important: checking "is the table empty?" alone would
 * re-seed the examples after a user deletes every task.
 */
export function seed(db) {
  const alreadySeeded = db
    .prepare("SELECT value FROM app_meta WHERE key = 'seeded'")
    .get();

  if (alreadySeeded) return;

  const insertTask = db.prepare(
    'INSERT INTO tasks (title, done) VALUES (?, ?)'
  );
  const markSeeded = db.prepare(
    "INSERT INTO app_meta (key, value) VALUES ('seeded', '1')"
  );

  db.transaction(() => {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();

    // Do not overwrite data if the file already contains tasks (for example,
    // an existing database created before app_meta was introduced).
    if (count === 0) {
      for (const task of SEED_TASKS) {
        insertTask.run(task.title, task.done);
      }
    }

    markSeeded.run();
  })();
}
