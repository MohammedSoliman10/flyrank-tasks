import { createDatabase } from '../src/db.js';

const sql = process.argv.slice(2).join(' ').trim();

if (!sql) {
  console.log('Usage: npm run sql -- "SELECT * FROM tasks;"');
  process.exit(1);
}

const db = createDatabase();

try {
  const statement = db.prepare(sql);

  if (statement.reader) {
    console.table(statement.all());
  } else {
    const result = statement.run();
    console.log(
      `${result.changes} row(s) changed (last insert id: ${result.lastInsertRowid})`
    );
  }
} catch (error) {
  console.error(`SQL error: ${error.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
