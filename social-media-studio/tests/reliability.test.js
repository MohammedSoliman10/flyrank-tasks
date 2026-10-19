import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RateLimitError } from '../src/adapters/errors.js';
import { ingestSample, makeContext } from './helpers.js';

async function approvedScheduled(ctx, platform = 'x') {
  const post = await ingestSample(ctx);
  const variant = post.variants.find((item) => item.platform === platform);
  ctx.campaigns.approveVariant(variant.id);
  const { slot } = ctx.campaigns.scheduleVariant(variant.id, '2026-10-19T12:00:00.000Z');
  return { post, variant, slot };
}

test('a retry after the adapter accepted but the response was lost creates one post', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const { slot } = await approvedScheduled(ctx);

  const base = ctx.adapters.mock_x;
  let first = true;
  ctx.adapters.mock_x = {
    name: 'mock_x',
    async publish(input) {
      const result = await base.publish(input);
      if (first) {
        first = false;
        throw new Error('simulated timeout after the platform accepted the post');
      }
      return result;
    },
  };

  const firstTick = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:01.000Z') });
  assert.equal(firstTick.results[0].status, 'retry_scheduled');
  assert.equal(
    ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count,
    1,
    'the platform already accepted the first write',
  );

  const retryTick = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:10.000Z') });
  assert.equal(retryTick.published, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM publish_attempts').get().count, 2);

  const slotRow = ctx.db.prepare('SELECT * FROM slots WHERE id = ?').get(slot.id);
  assert.equal(slotRow.status, 'published');
});

test('a stale publishing lease from a crashed worker is reclaimed without a duplicate', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const { slot } = await approvedScheduled(ctx);

  ctx.db
    .prepare(
      `UPDATE slots
       SET status = 'publishing', lease_until = '2026-10-19T11:59:00.000Z', updated_at = ?
       WHERE id = ?`,
    )
    .run('2026-10-19T11:59:00.000Z', slot.id);

  const result = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:01.000Z') });
  assert.equal(result.claimed, 1);
  assert.equal(result.published, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 1);

  const again = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:01:00.000Z') });
  assert.equal(again.claimed, 0);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 1);
});

test('429 Retry-After is respected and the publish succeeds after the wait', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const { slot } = await approvedScheduled(ctx);

  const base = ctx.adapters.mock_x;
  let limited = true;
  ctx.adapters.mock_x = {
    name: 'mock_x',
    async publish(input) {
      if (limited) {
        limited = false;
        throw new RateLimitError('simulated 429', 3);
      }
      return base.publish(input);
    },
  };

  const first = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:01.000Z') });
  assert.equal(first.rate_limited, 1);
  assert.equal(first.published, 0);

  const row = ctx.db.prepare('SELECT * FROM slots WHERE id = ?').get(slot.id);
  assert.equal(row.status, 'scheduled');
  assert.ok(row.next_attempt_at);
  assert.ok(Date.parse(row.next_attempt_at) > Date.parse('2026-10-19T12:00:01.000Z'));

  const tooSoon = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:02.000Z') });
  assert.equal(tooSoon.claimed, 0);

  const afterWait = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:05.000Z') });
  assert.equal(afterWait.published, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 1);
});

test('publish attempts are capped and a permanently failing slot is marked failed', async (t) => {
  const ctx = makeContext({ env: { MAX_ATTEMPTS: '2' } });
  t.after(() => ctx.close());
  const { slot } = await approvedScheduled(ctx);

  ctx.adapters.mock_x = {
    name: 'mock_x',
    async publish() {
      throw new Error('platform is down');
    },
  };

  const first = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:01.000Z') });
  assert.equal(first.results[0].status, 'retry_scheduled');

  const second = await ctx.publisher.runDue({ now: new Date('2026-10-19T12:00:20.000Z') });
  assert.equal(second.results[0].status, 'failed');

  const row = ctx.db.prepare('SELECT * FROM slots WHERE id = ?').get(slot.id);
  assert.equal(row.status, 'failed');
  assert.equal(row.attempts, 2);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 0);
});

test('the mock adapter itself is idempotent for a repeated key', async (t) => {
  const ctx = makeContext();
  t.after(() => ctx.close());
  const post = await ingestSample(ctx);
  const x = post.variants.find((variant) => variant.platform === 'x');
  const adapter = ctx.adapters.mock_x;
  const input = {
    variant: x,
    text: x.text,
    idempotencyKey: 'slot_test_repeat',
  };

  const first = await adapter.publish(input);
  const second = await adapter.publish(input);
  assert.equal(first.external_id, second.external_id);
  assert.equal(second.duplicate, true);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM mock_posts').get().count, 1);
});
