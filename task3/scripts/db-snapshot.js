import 'dotenv/config';
import pg from 'pg';

/**
 * Print the public tables and the current tasks rows using DATABASE_URL.
 * Useful for a quick check without opening psql.
 *
 *   npm run db:snapshot
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();

  const tables = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name
  `);

  console.log('Tables:');
  console.table(tables.rows);

  const tasks = await client.query(
    'SELECT id, title, done, created_at, updated_at FROM tasks ORDER BY id'
  );

  console.log(`Tasks (${tasks.rowCount}):`);
  console.table(tasks.rows);
} catch (error) {
  console.error(`Database snapshot failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
