import { createDatabase, DEFAULT_DB_PATH } from '../src/db.js';

const db = createDatabase();
const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();

console.log(`SQLite database ready: ${DEFAULT_DB_PATH}`);
console.log(`Tasks in database: ${count}`);

db.close();
