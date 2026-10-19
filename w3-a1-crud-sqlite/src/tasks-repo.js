const TASK_COLUMNS = 'id, title, done, created_at, updated_at';

/** Convert the SQLite 0/1 representation into a JSON-friendly boolean. */
function toTask(row) {
  return row ? { ...row, done: Boolean(row.done) } : null;
}

/**
 * All SQL lives in this repository, keeping the HTTP layer independent from
 * the storage layer. Swapping SQLite for another database later would mean
 * replacing this file, not rewriting the API.
 */
export function createTasksRepository(db) {
  const selectAll = db.prepare(
    `SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id ASC`
  );
  const selectById = db.prepare(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`
  );
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const update = db.prepare(`
    UPDATE tasks
       SET title = @title,
           done = @done,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = @id
  `);
  const remove = db.prepare('DELETE FROM tasks WHERE id = ?');

  return {
    list() {
      return selectAll.all().map(toTask);
    },

    getById(id) {
      return toTask(selectById.get(id));
    },

    create({ title, done = false }) {
      const result = insert.run(title, done ? 1 : 0);
      return this.getById(result.lastInsertRowid);
    },

    update(id, changes) {
      const current = this.getById(id);
      if (!current) return null;

      update.run({
        id,
        title: changes.title ?? current.title,
        done: (changes.done ?? current.done) ? 1 : 0,
      });

      return this.getById(id);
    },

    remove(id) {
      return remove.run(id).changes > 0;
    },
  };
}
