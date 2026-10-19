import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db.js';

/**
 * Each test gets its own SQLite file in a temporary directory, so tests never
 * touch the real tasks.db and can safely run in parallel.
 */
function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-api-'));
  const filename = path.join(directory, 'tasks.db');

  let db = createDatabase(filename);
  let app = createApp(db);

  return {
    filename,
    get app() {
      return app;
    },
    get db() {
      return db;
    },
    restart() {
      db.close();
      db = createDatabase(filename);
      app = createApp(db);
    },
    cleanup() {
      db.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('creates the schema and seeds three tasks once', () => {
  const context = setup();

  try {
    const rows = context.db.prepare('SELECT * FROM tasks').all();

    assert.equal(rows.length, 3);
    assert.equal(
      context.db.prepare("SELECT value FROM app_meta WHERE key = 'seeded'").get()
        .value,
      '1'
    );
  } finally {
    context.cleanup();
  }
});

test('seeds examples only once, even after every task is deleted', async () => {
  const context = setup();

  try {
    const seeded = await request(context.app).get('/tasks');
    assert.equal(seeded.status, 200);
    assert.equal(seeded.body.length, 3);

    for (const task of seeded.body) {
      const deleted = await request(context.app).delete(`/tasks/${task.id}`);
      assert.equal(deleted.status, 204);
    }

    context.restart();
    const afterRestart = await request(context.app).get('/tasks');
    assert.deepEqual(afterRestart.body, []);
  } finally {
    context.cleanup();
  }
});

test('GET /tasks returns all tasks from SQLite', async () => {
  const context = setup();

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
  } finally {
    context.cleanup();
  }
});

test('GET /tasks/:id returns one task and 404 for unknown ids', async () => {
  const context = setup();

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
    context.cleanup();
  }
});

test('POST /tasks creates a task that survives a restart', async () => {
  const context = setup();

  try {
    const created = await request(context.app)
      .post('/tasks')
      .send({ title: '  Write tests  ', done: true });

    assert.equal(created.status, 201);
    assert.equal(created.headers.location, `/tasks/${created.body.id}`);
    assert.equal(created.body.title, 'Write tests');
    assert.equal(created.body.done, true);

    context.restart();

    const response = await request(context.app).get('/tasks');
    assert.equal(response.body.length, 4);
    assert.ok(
      response.body.some((task) => task.title === 'Write tests' && task.done)
    );
  } finally {
    context.cleanup();
  }
});

test('POST /tasks rejects invalid input with 400', async () => {
  const context = setup();

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
    context.cleanup();
  }
});

test('PUT /tasks/:id updates a task and persists the change', async () => {
  const context = setup();

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

    context.restart();

    const afterRestart = await request(context.app).get('/tasks/1');
    assert.equal(afterRestart.body.title, 'Buy oat milk');
    assert.equal(afterRestart.body.done, false);
  } finally {
    context.cleanup();
  }
});

test('PUT /tasks/:id rejects invalid input and unknown ids', async () => {
  const context = setup();

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
    context.cleanup();
  }
});

test('DELETE /tasks/:id removes a task and returns 404 afterwards', async () => {
  const context = setup();

  try {
    const deleted = await request(context.app).delete('/tasks/2');
    assert.equal(deleted.status, 204);
    assert.equal(deleted.text, '');

    const missing = await request(context.app).get('/tasks/2');
    assert.equal(missing.status, 404);

    context.restart();

    const list = await request(context.app).get('/tasks');
    assert.equal(list.body.length, 2);
    assert.ok(!list.body.some((task) => task.id === 2));

    const deletedAgain = await request(context.app).delete('/tasks/2');
    assert.equal(deletedAgain.status, 404);
    assert.deepEqual(deletedAgain.body, { error: 'Task not found' });

    const badId = await request(context.app).delete('/tasks/not-a-number');
    assert.equal(badId.status, 404);
  } finally {
    context.cleanup();
  }
});
