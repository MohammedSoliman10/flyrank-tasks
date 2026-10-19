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

  return {
    list() {
      return selectAll.all().map(toTask);
    },

    getById(id) {
      return toTask(selectById.get(id));
    },
  };
}
