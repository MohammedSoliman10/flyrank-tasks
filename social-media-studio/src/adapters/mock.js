import { randomUUID } from 'node:crypto';

/**
 * A mock publisher records what it WOULD post. The unique idempotency key is
 * enforced by SQLite, so a retry returns the original record instead of
 * creating a second one.
 */
export class MockPublisher {
  constructor({ db, name }) {
    this.db = db;
    this.name = name;
  }

  async publish({ variant, text, idempotencyKey }) {
    const existing = this.db
      .prepare('SELECT * FROM mock_posts WHERE idempotency_key = ?')
      .get(idempotencyKey);

    if (existing) {
      return {
        external_id: `mock_${existing.id}`,
        external_url: `https://mock.local/${existing.platform}/${existing.id}`,
        duplicate: true,
      };
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO mock_posts (id, platform, idempotency_key, variant_id, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, variant.platform, idempotencyKey, variant.id, text, new Date().toISOString());

    return {
      external_id: `mock_${id}`,
      external_url: `https://mock.local/${variant.platform}/${id}`,
      duplicate: false,
    };
  }
}
