import { createHash, randomUUID } from 'node:crypto';

import { generateVariants } from '../captions.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { buildPostInput } from '../ingestion.js';
import { profileFor } from '../platforms.js';
import { assertVariant } from '../validation.js';

const ACTIVE_SLOT_STATUSES = ['scheduled', 'publishing'];

function nowIso() {
  return new Date().toISOString();
}

function idempotencyKeyFor(variantId, scheduledFor) {
  const digest = createHash('sha256')
    .update(`${variantId}:${scheduledFor}`)
    .digest('hex')
    .slice(0, 32);
  return `slot_${digest}`;
}

export class CampaignService {
  constructor({ db, config }) {
    this.db = db;
    this.config = config;
  }

  async ingest(input, { fetchImpl } = {}) {
    const postInput = await buildPostInput(input, { fetchImpl });
    const createdAt = nowIso();
    const post = {
      id: randomUUID(),
      title: postInput.title,
      content: postInput.content,
      source_url: postInput.source_url,
      created_at: createdAt,
    };

    const variants = generateVariants(post, this.config.activePlatforms).map((generated) => {
      const profile = profileFor(generated.platform);
      assertVariant(generated.text, profile);
      return {
        id: randomUUID(),
        post_id: post.id,
        platform: generated.platform,
        text: generated.text,
        status: 'draft',
        created_at: createdAt,
        updated_at: createdAt,
      };
    });

    const insert = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO posts (id, title, content, source_url, created_at)
           VALUES (@id, @title, @content, @source_url, @created_at)`,
        )
        .run(post);

      const statement = this.db.prepare(
        `INSERT INTO variants (id, post_id, platform, text, status, created_at, updated_at)
         VALUES (@id, @post_id, @platform, @text, @status, @created_at, @updated_at)`,
      );
      for (const variant of variants) statement.run(variant);
    });

    insert();
    return this.getPost(post.id);
  }

  listPosts() {
    return this.db
      .prepare(
        `SELECT p.*,
                (SELECT COUNT(*) FROM variants v WHERE v.post_id = p.id) AS variant_count,
                (SELECT COUNT(*) FROM variants v WHERE v.post_id = p.id AND v.status = 'published') AS published_count
         FROM posts p
         ORDER BY p.created_at DESC`,
      )
      .all();
  }

  getPost(id) {
    const post = this.db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!post) throw new NotFoundError(`Post ${id} not found`);

    const variants = this.db
      .prepare('SELECT * FROM variants WHERE post_id = ? ORDER BY platform')
      .all(id);
    const slots = this.db
      .prepare(
        `SELECT s.* FROM slots s
         JOIN variants v ON v.id = s.variant_id
         WHERE v.post_id = ?
         ORDER BY s.scheduled_for`,
      )
      .all(id);

    return {
      ...post,
      variants: variants.map((variant) => ({
        ...variant,
        slots: slots.filter((slot) => slot.variant_id === variant.id),
      })),
    };
  }

  getVariant(id) {
    const row = this.db
      .prepare(
        `SELECT v.*, p.title AS post_title, p.source_url AS post_source_url
         FROM variants v JOIN posts p ON p.id = v.post_id
         WHERE v.id = ?`,
      )
      .get(id);
    if (!row) throw new NotFoundError(`Variant ${id} not found`);
    return row;
  }

  updateVariantText(id, text) {
    const variant = this.getVariant(id);
    if (variant.status === 'published') {
      throw new ConflictError('A published variant cannot be edited');
    }

    const value = String(text ?? '');
    if (!value.trim()) throw new BadRequestError('Variant text must not be empty');

    const profile = profileFor(variant.platform);
    try {
      assertVariant(value, profile);
    } catch (error) {
      error.status = 422;
      throw error;
    }

    const updatedAt = nowIso();
    this.db
      .prepare(
        `UPDATE variants
         SET text = ?, status = 'draft', rejection_reason = NULL,
             approved_at = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(value, updatedAt, id);
    return this.getVariant(id);
  }

  approveVariant(id) {
    const variant = this.getVariant(id);
    if (variant.status === 'published') {
      throw new ConflictError('A published variant cannot be approved again');
    }

    const updatedAt = nowIso();
    this.db
      .prepare(
        `UPDATE variants
         SET status = 'approved', approved_at = COALESCE(approved_at, ?),
             rejection_reason = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(updatedAt, updatedAt, id);
    return this.getVariant(id);
  }

  rejectVariant(id, reason = null) {
    const variant = this.getVariant(id);
    if (variant.status === 'published') {
      throw new ConflictError('A published variant cannot be rejected');
    }

    const updatedAt = nowIso();
    this.db
      .prepare(
        `UPDATE variants
         SET status = 'rejected', rejection_reason = ?, approved_at = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(reason, updatedAt, id);
    return this.getVariant(id);
  }

  scheduleVariant(id, scheduledFor) {
    const variant = this.getVariant(id);
    if (variant.status !== 'approved') {
      throw new ConflictError(
        `Variant must be approved before scheduling (current status: ${variant.status})`,
      );
    }

    const date = new Date(scheduledFor);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError('scheduled_for must be a valid ISO-8601 date');
    }
    const scheduledIso = date.toISOString();

    const activeSlot = this.db
      .prepare(
        `SELECT * FROM slots
         WHERE variant_id = ? AND status IN (${ACTIVE_SLOT_STATUSES.map(() => '?').join(',')})
         ORDER BY scheduled_for LIMIT 1`,
      )
      .get(id, ...ACTIVE_SLOT_STATUSES);

    if (activeSlot) {
      throw new ConflictError(
        `Variant already has an active slot at ${activeSlot.scheduled_for} (${activeSlot.status})`,
      );
    }

    const slot = {
      id: randomUUID(),
      variant_id: id,
      scheduled_for: scheduledIso,
      status: 'scheduled',
      idempotency_key: idempotencyKeyFor(id, scheduledIso),
      attempts: 0,
      next_attempt_at: scheduledIso,
      lease_until: null,
      external_id: null,
      external_url: null,
      last_error: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      this.db
        .prepare(
          `INSERT INTO slots (
             id, variant_id, scheduled_for, status, idempotency_key, attempts,
             next_attempt_at, lease_until, external_id, external_url, last_error,
             created_at, updated_at
           ) VALUES (
             @id, @variant_id, @scheduled_for, @status, @idempotency_key, @attempts,
             @next_attempt_at, @lease_until, @external_id, @external_url, @last_error,
             @created_at, @updated_at
           )`,
        )
        .run(slot);
      return { slot, created: true };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const existing = this.db
          .prepare('SELECT * FROM slots WHERE idempotency_key = ?')
          .get(slot.idempotency_key);
        if (existing) return { slot: existing, created: false };
      }
      throw error;
    }
  }

  listSlots() {
    return this.db
      .prepare(
        `SELECT s.*, v.platform, v.status AS variant_status, p.title AS post_title
         FROM slots s
         JOIN variants v ON v.id = s.variant_id
         JOIN posts p ON p.id = v.post_id
         ORDER BY s.scheduled_for ASC`,
      )
      .all();
  }

  listHistory() {
    return this.db
      .prepare(
        `SELECT a.*, s.scheduled_for, s.status AS slot_status,
                v.platform, v.text, p.title AS post_title
         FROM publish_attempts a
         JOIN slots s ON s.id = a.slot_id
         JOIN variants v ON v.id = s.variant_id
         JOIN posts p ON p.id = v.post_id
         ORDER BY a.id DESC`,
      )
      .all();
  }

  listMockPosts() {
    return this.db.prepare('SELECT * FROM mock_posts ORDER BY created_at DESC').all();
  }
}
