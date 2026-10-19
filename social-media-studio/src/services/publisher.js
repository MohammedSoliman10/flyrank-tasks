import { adapterFor } from '../adapters/registry.js';
import { RateLimitError } from '../adapters/errors.js';

export class PublisherService {
  constructor({ db, config, adapters, logger = console }) {
    this.db = db;
    this.config = config;
    this.adapters = adapters;
    this.logger = logger;

    this.claimTransaction = this.db.transaction(({ now, leaseUntil, limit }) => {
      const due = this.db
        .prepare(
          `SELECT * FROM slots
           WHERE (
             (status = 'scheduled'
              AND (next_attempt_at IS NULL OR next_attempt_at <= @now)
              AND scheduled_for <= @now)
             OR
             (status = 'publishing'
              AND lease_until IS NOT NULL
              AND lease_until <= @now)
           )
           ORDER BY scheduled_for ASC
           LIMIT @limit`,
        )
        .all({ now, limit });

      const claim = this.db.prepare(
        `UPDATE slots
         SET status = 'publishing', lease_until = @lease_until, updated_at = @now
         WHERE id = @id AND status IN ('scheduled', 'publishing')`,
      );

      const claimed = [];
      for (const slot of due) {
        const result = claim.run({ id: slot.id, lease_until: leaseUntil, now });
        if (result.changes === 1) {
          claimed.push({ ...slot, status: 'publishing', lease_until: leaseUntil });
        }
      }

      return claimed;
    });
  }

  async runDue({ limit = 10, now = new Date() } = {}) {
    const nowString = now.toISOString();
    const leaseUntil = new Date(now.getTime() + this.config.leaseMs).toISOString();
    const claimed = this.claimTransaction.immediate({ now: nowString, leaseUntil, limit });
    const results = [];

    for (const slot of claimed) {
      results.push(await this.publishSlot(slot, { now }));
    }

    return {
      checked_at: nowString,
      claimed: claimed.length,
      results,
      published: results.filter((result) => result.status === 'published').length,
      failed: results.filter((result) => result.status === 'failed').length,
      retrying: results.filter((result) => result.status === 'retry_scheduled').length,
      rate_limited: results.filter((result) => result.status === 'rate_limited').length,
    };
  }

  async publishSlot(slot, { now = new Date() } = {}) {
    const variant = this.db.prepare('SELECT * FROM variants WHERE id = ?').get(slot.variant_id);
    if (!variant) throw new Error(`Variant ${slot.variant_id} disappeared while publishing`);

    const adapter = adapterFor(variant.platform, { adapters: this.adapters, config: this.config });
    const attemptNo = slot.attempts + 1;
    const attemptedAt = now.toISOString();

    try {
      const result = await adapter.publish({
        variant,
        text: variant.text,
        idempotencyKey: slot.idempotency_key,
      });

      this.db.transaction(() => {
        this.db
          .prepare(
            `UPDATE slots
             SET status = 'published', attempts = ?, lease_until = NULL,
                 next_attempt_at = NULL, last_error = NULL,
                 external_id = ?, external_url = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(attemptNo, result.external_id ?? null, result.external_url ?? null, attemptedAt, slot.id);

        this.db
          .prepare(
            `UPDATE variants
             SET status = 'published', published_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(attemptedAt, attemptedAt, variant.id);

        this.db
          .prepare(
            `INSERT INTO publish_attempts (
               slot_id, attempt_no, status, adapter, idempotency_key,
               external_id, external_url, error, created_at
             ) VALUES (?, ?, 'success', ?, ?, ?, ?, NULL, ?)`,
          )
          .run(
            slot.id,
            attemptNo,
            adapter.name,
            slot.idempotency_key,
            result.external_id ?? null,
            result.external_url ?? null,
            attemptedAt,
          );
      })();

      this.logger.log(
        `[publish] ${variant.platform} slot=${slot.id} status=published attempt=${attemptNo}`,
      );
      return { slot_id: slot.id, status: 'published', external_id: result.external_id ?? null };
    } catch (error) {
      const isRateLimit = error instanceof RateLimitError;
      const isFinal = attemptNo >= this.config.maxAttempts;
      const backoffMs = isRateLimit
        ? error.retryAfterSeconds * 1000
        : Math.min(60_000, 1000 * 2 ** Math.max(0, attemptNo - 1));
      const nextAttemptAt = new Date(now.getTime() + backoffMs).toISOString();
      const nextStatus = isFinal ? 'failed' : 'scheduled';

      this.db.transaction(() => {
        this.db
          .prepare(
            `UPDATE slots
             SET status = ?, attempts = ?, lease_until = NULL,
                 next_attempt_at = ?, last_error = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            nextStatus,
            attemptNo,
            isFinal ? null : nextAttemptAt,
            String(error.message || error),
            attemptedAt,
            slot.id,
          );

        this.db
          .prepare(
            `INSERT INTO publish_attempts (
               slot_id, attempt_no, status, adapter, idempotency_key,
               external_id, external_url, error, created_at
             ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
          )
          .run(
            slot.id,
            attemptNo,
            isRateLimit ? 'rate_limited' : 'failed',
            adapter.name,
            slot.idempotency_key,
            String(error.message || error),
            attemptedAt,
          );
      })();

      this.logger.log(
        `[publish] ${variant.platform} slot=${slot.id} status=${nextStatus} attempt=${attemptNo} error=${error.message}`,
      );

      return {
        slot_id: slot.id,
        status: isFinal ? 'failed' : isRateLimit ? 'rate_limited' : 'retry_scheduled',
        attempt: attemptNo,
        next_attempt_at: isFinal ? null : nextAttemptAt,
        error: error.message,
      };
    }
  }
}
