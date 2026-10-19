import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTasksRepository } from '../src/tasks-repo.js';
import { startPostgres } from './helpers/postgres.js';

let postgres;

before(async () => {
  postgres = await startPostgres();
});

after(async () => {
  await postgres.cleanup();
});

async function resetDatabase() {
  const client = new pg.Client({ connectionString: postgres.connectionString });
  await client.connect();

  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}

/**
 * Fresh schema + repository for each test. `restart()` closes the pool and
 * opens a new one against the same database, exactly like restarting the app.
 */
async function setup() {
  await resetDatabase();

  let repository = await createTasksRepository({
    connectionString: postgres.connectionString,
  });
  let app = createApp(repository);
  let closed = false;

  async function close() {
    if (closed) return;
    closed = true;
    await repository.close();
  }

  return {
    get app() {
      return app;
    },
    get repository() {
      return repository;
    },
    async restart() {
      await close();
      repository = await createTasksRepository({
        connectionString: postgres.connectionString,
      });
      app = createApp(repository);
      closed = false;
    },
    close,
  };
}

test('creates the schema and seeds three tasks once', async () => {
  const context = await setup();

  try {
    const rows = await context.repository.list();
    assert.equal(rows.length, 3);

    const client = new pg.Client({ connectionString: postgres.connectionString });
    await client.connect();

    try {
      const marker = await client.query(
        "SELECT value FROM app_meta WHERE key = 'seeded'"
      );
      assert.equal(marker.rows[0].value, '1');
    } finally {
      await client.end();
    }

    await context.restart();
    assert.equal((await context.repository.list()).length, 3);
  } finally {
    await context.close();
  }
});

test('seeds examples only once, even after every task is deleted', async () => {
  const context = await setup();

  try {
    const seeded = await request(context.app).get('/tasks');
    assert.equal(seeded.status, 200);
    assert.equal(seeded.body.length, 3);

    for (const task of seeded.body) {
      const deleted = await request(context.app).delete(`/tasks/${task.id}`);
      assert.equal(deleted.status, 204);
    }

    await context.restart();

    const afterRestart = await request(context.app).get('/tasks');
    assert.deepEqual(afterRestart.body, []);
  } finally {
    await context.close();
  }
});

test('GET /tasks returns all tasks from PostgreSQL', async () => {
  const context = await setup();

  try {
    const response = await request(context.app).get('/tasks');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 3);
    assert.deepEqual(Object.keys(response.body[0]), [
      'id',
      'title',
      'done',
      'created_at',
      'updated_at',
    ]);
    assert.equal(typeof response.body[0].done, 'boolean');
    assert.match(response.body[0].created_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await context.close();
  }
});

test('GET /tasks/:id returns one task and 404 for unknown ids', async () => {
  const context = await setup();

  try {
    const found = await request(context.app).get('/tasks/1');
    assert.equal(found.status, 200);
    assert.equal(found.body.id, 1);

    for (const id of ['999', 'abc', '0', '-1', '1.5']) {
      const missing = await request(context.app).get(`/tasks/${id}`);
      assert.equal(missing.status, 404);
      assert.deepEqual(missing.body, { error: 'Task not found' });
    }
  } finally {
    await context.close();
  }
});

test('POST /tasks creates a task that survives an app restart', async () => {
  const context = await setup();

  try {
    const created = await request(context.app)
      .post('/tasks')
      .send({ title: '  Write tests  ', done: true });

    assert.equal(created.status, 201);
    assert.equal(created.headers.location, `/tasks/${created.body.id}`);
    assert.equal(created.body.title, 'Write tests');
    assert.equal(created.body.done, true);

    await context.restart();

    const response = await request(context.app).get('/tasks');
    assert.equal(response.body.length, 4);
    assert.ok(
      response.body.some((task) => task.title === 'Write tests' && task.done)
    );
  } finally {
    await context.close();
  }
});

test('POST /tasks rejects invalid input with 400', async () => {
  const context = await setup();

  try {
    const cases = [
      [{}, 'Title is required'],
      [{ title: '   ' }, 'Title is required'],
      [{ title: 42 }, 'Title is required'],
      [{ title: 'Valid', done: 'yes' }, 'Done must be a boolean'],
    ];

    for (const [body, error] of cases) {
      const response = await request(context.app).post('/tasks').send(body);
      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error });
    }

    const malformed = await request(context.app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title":');

    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.body, { error: 'Invalid JSON body' });

    const tasks = await request(context.app).get('/tasks');
    assert.equal(tasks.body.length, 3);
  } finally {
    await context.close();
  }
});

test('PUT /tasks/:id updates a task and persists the change', async () => {
  const context = await setup();

  try {
    const updated = await request(context.app)
      .put('/tasks/1')
      .send({ title: 'Buy oat milk', done: true });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.id, 1);
    assert.equal(updated.body.title, 'Buy oat milk');
    assert.equal(updated.body.done, true);

    const partial = await request(context.app)
      .patch('/tasks/1')
      .send({ done: false });

    assert.equal(partial.status, 200);
    assert.equal(partial.body.title, 'Buy oat milk');
    assert.equal(partial.body.done, false);

    await context.restart();

    const afterRestart = await request(context.app).get('/tasks/1');
    assert.equal(afterRestart.body.title, 'Buy oat milk');
    assert.equal(afterRestart.body.done, false);
  } finally {
    await context.close();
  }
});

test('PUT /tasks/:id rejects invalid input and unknown ids', async () => {
  const context = await setup();

  try {
    const invalidBodies = [
      [{}, 'Provide at least one of title or done'],
      [{ title: '' }, 'Title is required'],
      [{ title: 10 }, 'Title is required'],
      [{ done: 1 }, 'Done must be a boolean'],
    ];

    for (const [body, error] of invalidBodies) {
      const response = await request(context.app).put('/tasks/1').send(body);
      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error });
    }

    const unknown = await request(context.app)
      .put('/tasks/999')
      .send({ title: 'Nope' });

    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, { error: 'Task not found' });
  } finally {
    await context.close();
  }
});

test('DELETE /tasks/:id removes a task and returns 404 afterwards', async () => {
  const context = await setup();

  try {
    const deleted = await request(context.app).delete('/tasks/2');
    assert.equal(deleted.status, 204);
    assert.equal(deleted.text, '');

    const missing = await request(context.app).get('/tasks/2');
    assert.equal(missing.status, 404);

    await context.restart();

    const list = await request(context.app).get('/tasks');
    assert.equal(list.body.length, 2);
    assert.ok(!list.body.some((task) => task.id === 2));

    const deletedAgain = await request(context.app).delete('/tasks/2');
    assert.equal(deletedAgain.status, 404);
    assert.deepEqual(deletedAgain.body, { error: 'Task not found' });

    const badId = await request(context.app).delete('/tasks/not-a-number');
    assert.equal(badId.status, 404);
  } finally {
    await context.close();
  }
});

test('GET /tasks supports search, done filter and sorting via SQL', async () => {
  const context = await setup();

  try {
    const search = await request(context.app)
      .get('/tasks')
      .query({ search: 'milk' });

    assert.equal(search.status, 200);
    assert.deepEqual(
      search.body.map((task) => task.title),
      ['Buy milk']
    );

    const completed = await request(context.app)
      .get('/tasks')
      .query({ done: 'true' });

    assert.deepEqual(
      completed.body.map((task) => task.title),
      ['Finish the FlyRank assignment']
    );

    const pending = await request(context.app)
      .get('/tasks')
      .query({ done: 'false', sort: 'title' });

    assert.deepEqual(
      pending.body.map((task) => task.title),
      ['Buy milk', 'Walk the dog']
    );

    const descending = await request(context.app)
      .get('/tasks')
      .query({ sort: 'title', order: 'desc' });

    assert.deepEqual(
      descending.body.map((task) => task.title),
      ['Walk the dog', 'Finish the FlyRank assignment', 'Buy milk']
    );

    await request(context.app).post('/tasks').send({ title: '100% done' });

    const literalPercent = await request(context.app)
      .get('/tasks')
      .query({ search: '%' });

    assert.deepEqual(
      literalPercent.body.map((task) => task.title),
      ['100% done']
    );
  } finally {
    await context.close();
  }
});

test('GET /tasks rejects invalid query parameters', async () => {
  const context = await setup();

  try {
    const cases = [
      [{ done: 'maybe' }, 'Done must be true or false'],
      [{ sort: 'created_at' }, 'Sort must be id or title'],
      [{ order: 'sideways' }, 'Order must be asc or desc'],
      [{ done: ['true', 'false'] }, 'Done must be true or false'],
    ];

    for (const [query, error] of cases) {
      const response = await request(context.app).get('/tasks').query(query);
      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error });
    }
  } finally {
    await context.close();
  }
});

test('GET /stats counts tasks with SQL aggregates', async () => {
  const context = await setup();

  try {
    const initial = await request(context.app).get('/stats');
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body, { total: 3, completed: 1, pending: 2 });

    await request(context.app)
      .post('/tasks')
      .send({ title: 'Another finished task', done: true });

    const updated = await request(context.app).get('/stats');
    assert.deepEqual(updated.body, { total: 4, completed: 2, pending: 2 });
  } finally {
    await context.close();
  }
});

test('GET /health checks the database connection', async () => {
  const context = await setup();

  try {
    const response = await request(context.app).get('/health');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok', db: 'ok' });
  } finally {
    await context.close();
  }
});

test('values are passed as parameters, not concatenated into SQL', async () => {
  const context = await setup();

  try {
    const maliciousTitle = "Robert'); DROP TABLE tasks;--";
    const created = await request(context.app)
      .post('/tasks')
      .send({ title: maliciousTitle });

    assert.equal(created.status, 201);
    assert.equal(created.body.title, maliciousTitle);

    const injectionSearch = await request(context.app)
      .get('/tasks')
      .query({ search: "' OR 1=1 --" });

    assert.deepEqual(injectionSearch.body, []);

    const injectionId = await request(context.app).get('/tasks/1 OR 1=1');
    assert.equal(injectionId.status, 404);

    const list = await request(context.app).get('/tasks');
    assert.equal(list.body.length, 4);
  } finally {
    await context.close();
  }
});

test('data survives a full PostgreSQL stop and start', async () => {
  const context = await setup();

  try {
    const created = await request(context.app)
      .post('/tasks')
      .send({ title: 'Survives a database restart', done: false });

    assert.equal(created.status, 201);

    await context.close();
    await postgres.stop();
    await postgres.start();
    await context.restart();

    const response = await request(context.app).get('/tasks');
    assert.equal(response.body.length, 4);
    assert.ok(
      response.body.some(
        (task) => task.title === 'Survives a database restart'
      )
    );

    const stats = await request(context.app).get('/stats');
    assert.deepEqual(stats.body, { total: 4, completed: 1, pending: 3 });
  } finally {
    await context.close();
  }
});
