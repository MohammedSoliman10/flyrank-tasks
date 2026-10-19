import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';

import { ingestSample, makeContext } from './helpers.js';

function variantFor(post, platform) {
  return post.variants.find((variant) => variant.platform === platform);
}

test('health and platform discovery report the active adapter configuration', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());

  const health = await request(ctx.app).get('/health').expect(200);
  assert.equal(health.body.status, 'ok');
  assert.deepEqual(health.body.platforms, ['x', 'linkedin']);

  const platforms = await request(ctx.app).get('/api/platforms').expect(200);
  assert.equal(platforms.body.platforms.length, 2);
  assert.equal(platforms.body.platforms[0].platform, 'x');
  assert.equal(platforms.body.platforms[0].adapter, 'mock_x');
  assert.equal(platforms.body.platforms[0].configured, true);
});

test('ingestion creates one distinct variant per configured platform', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());

  const response = await request(ctx.app)
    .post('/api/posts')
    .send({
      title: 'Reliable publishing is a product feature',
      content: `# Reliable publishing is a product feature

A retry should never become a duplicate post. Durable scheduling matters.`,
      url: 'https://example.com/blog/reliable-publishing',
    })
    .expect(201);

  assert.equal(response.body.variants.length, 2);
  const x = variantFor(response.body, 'x');
  const linkedin = variantFor(response.body, 'linkedin');
  assert.equal(x.status, 'draft');
  assert.equal(linkedin.status, 'draft');
  assert.notEqual(x.text, linkedin.text);
  assert.match(x.text, /#FlyRank/);
  assert.match(linkedin.text, /#Engineering/);
  assert.ok(Array.from(x.text).length <= 280);
  assert.ok(Array.from(linkedin.text).length <= 1300);
});

test('ingestion accepts pasted Markdown without a URL', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());

  const response = await request(ctx.app)
    .post('/api/posts')
    .send({ content: '# A pasted post\n\nThis came from the editor, not a URL.' })
    .expect(201);

  assert.equal(response.body.title, 'A pasted post');
  assert.equal(response.body.variants.length, 2);
});

test('ingestion blocks SSRF-style localhost URLs and malformed input', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());

  const localhost = await request(ctx.app)
    .post('/api/posts')
    .send({ url: 'http://127.0.0.1/internal' })
    .expect(400);
  assert.match(localhost.body.error, /public host/i);

  const empty = await request(ctx.app).post('/api/posts').send({}).expect(400);
  assert.equal(empty.body.error, 'Validation failed');
});

test('URL ingestion extracts a title and readable content', async (t) => {
  const html = `<!doctype html><html><head><title>Blog title</title></head>
    <body><article><h1>Fetched post</h1><p>Hello from the web.</p></article></body></html>`;
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    text: async () => html,
  });
  const ctx = makeContext({ fetchImpl });
  t.after(() => ctx.close());

  const response = await request(ctx.app)
    .post('/api/posts')
    .send({ url: 'https://example.com/post' })
    .expect(201);

  assert.equal(response.body.title, 'Fetched post');
  assert.match(response.body.content, /Hello from the web/);
  assert.equal(response.body.source_url, 'https://example.com/post');
});

test('an unapproved variant cannot be scheduled', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const post = await ingestSample(ctx);
  const x = variantFor(post, 'x');

  const response = await request(ctx.app)
    .post(`/api/variants/${x.id}/schedule`)
    .send({ scheduled_for: '2026-10-19T12:00:00.000Z' })
    .expect(409);

  assert.match(response.body.error, /must be approved before scheduling/i);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM slots').get().count, 0);
});

test('editing a variant enforces the platform profile and names the broken rule', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const post = await ingestSample(ctx);
  const x = variantFor(post, 'x');

  const tooLong = await request(ctx.app)
    .patch(`/api/variants/${x.id}`)
    .send({ text: `${'a'.repeat(400)} #One #Two` })
    .expect(422);

  assert.equal(tooLong.body.error, 'Constraint validation failed');
  assert.ok(tooLong.body.details.some((detail) => detail.rule === 'max_length'));

  const noHashtags = await request(ctx.app)
    .patch(`/api/variants/${x.id}`)
    .send({ text: 'A clean caption with no tags.' })
    .expect(422);
  assert.ok(noHashtags.body.details.some((detail) => detail.rule === 'min_hashtags'));

  const valid = await request(ctx.app)
    .patch(`/api/variants/${x.id}`)
    .send({ text: 'A short, valid update. #FlyRank' })
    .expect(200);
  assert.equal(valid.body.status, 'draft');
  assert.equal(valid.body.text, 'A short, valid update. #FlyRank');
});

test('approve, reject, and re-approve move a variant through review', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const post = await ingestSample(ctx);
  const x = variantFor(post, 'x');

  const rejected = await request(ctx.app)
    .post(`/api/variants/${x.id}/reject`)
    .send({ reason: 'Tone is too casual' })
    .expect(200);
  assert.equal(rejected.body.status, 'rejected');
  assert.equal(rejected.body.rejection_reason, 'Tone is too casual');

  const approved = await request(ctx.app)
    .post(`/api/variants/${x.id}/approve`)
    .send({})
    .expect(200);
  assert.equal(approved.body.status, 'approved');
  assert.ok(approved.body.approved_at);
});

test('a scheduled variant publishes once through the mock adapter', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const post = await ingestSample(ctx);
  const x = variantFor(post, 'x');

  await request(ctx.app).post(`/api/variants/${x.id}/approve`).send({}).expect(200);

  const scheduled = await request(ctx.app)
    .post(`/api/variants/${x.id}/schedule`)
    .send({ scheduled_for: '2026-10-19T12:00:00.000Z' })
    .expect(201);

  assert.equal(scheduled.body.slot.status, 'scheduled');
  assert.match(scheduled.body.slot.idempotency_key, /^slot_[0-9a-f]{32}$/);

  const tick = await request(ctx.app)
    .post('/api/admin/tick')
    .send({ now: '2026-10-19T12:00:01.000Z' })
    .expect(200);

  assert.equal(tick.body.published, 1);
  assert.equal(tick.body.results[0].status, 'published');

  const mockPosts = await request(ctx.app).get('/api/mock-posts').expect(200);
  assert.equal(mockPosts.body.posts.length, 1);
  assert.equal(mockPosts.body.posts[0].platform, 'x');

  const history = await request(ctx.app).get('/api/history').expect(200);
  assert.equal(history.body.attempts.length, 1);
  assert.equal(history.body.attempts[0].status, 'success');

  const secondTick = await request(ctx.app)
    .post('/api/admin/tick')
    .send({ now: '2026-10-19T12:05:00.000Z' })
    .expect(200);
  assert.equal(secondTick.body.published, 0);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 1);
});

test('repeated schedule requests for the same active variant are refused', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const post = await ingestSample(ctx);
  const x = variantFor(post, 'x');
  await request(ctx.app).post(`/api/variants/${x.id}/approve`).send({}).expect(200);

  await request(ctx.app)
    .post(`/api/variants/${x.id}/schedule`)
    .send({ scheduled_for: '2026-10-19T12:00:00.000Z' })
    .expect(201);

  const duplicate = await request(ctx.app)
    .post(`/api/variants/${x.id}/schedule`)
    .send({ scheduled_for: '2026-10-19T13:00:00.000Z' })
    .expect(409);
  assert.match(duplicate.body.error, /active slot/i);
});

test('unknown resources and malformed JSON get clean 4xx responses', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());

  await request(ctx.app).get('/api/posts/nope').expect(404);
  await request(ctx.app).get('/api/variants/nope').expect(404);

  const malformed = await request(ctx.app)
    .post('/api/posts')
    .set('Content-Type', 'application/json')
    .send('{"content":');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error, 'Malformed JSON body');
});

test('adapter swap is configuration only: the same x variant can publish through a different mock', async (t) => {
  const alt = makeContext({ env: { ADAPTER_X: 'mock_linkedin' } });
  t.after(() => alt.close());
  const post = await ingestSample(alt);
  const x = variantFor(post, 'x');
  assert.equal(alt.config.adapterFor('x'), 'mock_linkedin');

  await request(alt.app).post(`/api/variants/${x.id}/approve`).send({}).expect(200);
  await request(alt.app)
    .post(`/api/variants/${x.id}/schedule`)
    .send({ scheduled_for: '2026-10-19T12:00:00.000Z' })
    .expect(201);
  await request(alt.app)
    .post('/api/admin/tick')
    .send({ now: '2026-10-19T12:00:01.000Z' })
    .expect(200);

  const rows = alt.db.prepare('SELECT platform FROM mock_posts').all();
  assert.deepEqual(rows, [{ platform: 'x' }]);
});
