import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  CACHE_DIR,
  DELAY_MS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
} from './config.js';

export class FetchError extends Error {
  constructor(message, { url, status = null, code = 'fetch_error', retryable = false } = {}) {
    super(message);
    this.name = 'FetchError';
    this.url = url;
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function catalogueCachePath(pageNumber) {
  return join(CACHE_DIR, `catalogue-page-${pageNumber}.html`);
}

export function bookCachePath(url) {
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 24);
  return join(CACHE_DIR, 'books', `${digest}.html`);
}

/**
 * Sequential HTTP client with a deliberate delay, timeout, one retry for
 * timeout/5xx failures, and an on-disk HTML cache.
 *
 * A cache hit does not touch the network and therefore does not sleep.
 */
export class PoliteClient {
  constructor({
    delayMs = DELAY_MS,
    timeoutMs = REQUEST_TIMEOUT_MS,
    userAgent = USER_AGENT,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.delayMs = delayMs;
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
    this.fetchImpl = fetchImpl;
    this.lastRequestAt = 0;
  }

  async get(url, { cachePath, refresh = false } = {}) {
    if (!cachePath) throw new Error('PoliteClient.get requires a cachePath');

    if (!refresh) {
      try {
        const info = await stat(cachePath);
        const html = await readFile(cachePath, 'utf8');
        return {
          html,
          fromCache: true,
          status: 200,
          fetchedAt: info.mtime.toISOString(),
          attempts: 0,
        };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    let lastError;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.#waitForNextSlot();

      let response;
      try {
        response = await this.fetchImpl(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml',
          },
        });
      } catch (error) {
        this.lastRequestAt = Date.now();
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        lastError = new FetchError(
          timedOut ? `Timeout after ${this.timeoutMs}ms` : `Network error: ${error.message}`,
          { url, code: timedOut ? 'timeout' : 'network', retryable: timedOut },
        );

        if (timedOut && attempt === 1) {
          await sleep(this.delayMs);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        this.lastRequestAt = Date.now();
        const retryable = response.status >= 500;
        lastError = new FetchError(`HTTP ${response.status}`, {
          url,
          status: response.status,
          code: 'http',
          retryable,
        });

        if (retryable && attempt === 1) {
          await sleep(this.delayMs);
          continue;
        }
        throw lastError;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType && !contentType.toLowerCase().includes('text/html')) {
        this.lastRequestAt = Date.now();
        throw new FetchError(`Unexpected content type: ${contentType}`, {
          url,
          status: response.status,
          code: 'content_type',
        });
      }

      const html = await response.text();
      this.lastRequestAt = Date.now();
      const fetchedAt = new Date().toISOString();
      await mkdir(dirname(cachePath), { recursive: true });
      const temporary = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporary, html, 'utf8');
      await rename(temporary, cachePath);

      return {
        html,
        fromCache: false,
        status: response.status,
        fetchedAt,
        attempts: attempt,
      };
    }

    throw lastError;
  }

  async #waitForNextSlot() {
    const wait = this.delayMs - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);
  }
}
