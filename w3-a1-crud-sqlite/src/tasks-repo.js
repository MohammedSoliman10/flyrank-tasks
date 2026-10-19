const TASK_COLUMNS = 'id, title, done, created_at, updated_at';

// ORDER BY cannot use bound parameters, so only allow these exact, safe values.
const SORT_COLUMNS = {
  id: 'id',
  title: 'title COLLATE NOCASE',
};

/** Convert the SQLite 0/1 representation into a JSON-friendly boolean. */
function toTask(row) {
  return row ? { ...row, done: Boolean(row.done) } : null;
}

/** Escape LIKE wildcards so a search for "50%" matches a literal "50%". */
function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * All SQL lives in this repository, keeping the HTTP layer independent from
 * the storage layer. Swapping SQLite for another database later would mean
 * replacing this file, not rewriting the API.
 */
export function createTasksRepository(db) {
  const selectById = db.prepare(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`
  );
  const selectStats = db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(done), 0) AS completed FROM tasks
  `);
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
    list({ search, done, sort = 'id', order = 'asc' } = {}) {
      const conditions = [];
      const params = {};

      if (search) {
        conditions.push("title LIKE @search ESCAPE '\\'");
        params.search = `%${escapeLike(search)}%`;
      }

      if (typeof done === 'boolean') {
        conditions.push('done = @done');
        params.done = done ? 1 : 0;
      }

      const direction = order === 'desc' ? 'DESC' : 'ASC';
      const orderBy = sort === 'title'
        ? `${SORT_COLUMNS.title} ${direction}, id ASC`
        : `${SORT_COLUMNS.id} ${direction}`;

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      return db
        .prepare(
          `SELECT ${TASK_COLUMNS} FROM tasks ${where} ORDER BY ${orderBy}`
        )
        .all(params)
        .map(toTask);
    },

    getById(id) {
      return toTask(selectById.get(id));
    },

    stats() {
      const { total, completed } = selectStats.get();
      return { total, completed, pending: total - completed };
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
