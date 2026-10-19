import { AdapterError, RateLimitError } from './errors.js';

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function retryAfterSeconds(response, body) {
  const header = response.headers.get('retry-after');
  if (header && Number.isFinite(Number(header))) return Number(header);
  if (Number.isFinite(Number(body?.retry_after))) return Number(body.retry_after);
  return 1;
}

export class MastodonPublisher {
  constructor({ baseUrl, accessToken, fetchImpl = globalThis.fetch }) {
    this.name = 'mastodon';
    this.baseUrl = String(baseUrl || 'https://mastodon.social').replace(/\/+$/, '');
    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
  }

  async publish({ text }) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/v1/statuses`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ status: text, visibility: 'unlisted' }),
      });
    } catch {
      throw new AdapterError('Mastodon request failed before receiving a response');
    }

    const body = await readJson(response);
    if (response.status === 429) {
      throw new RateLimitError('Mastodon rate limit reached', retryAfterSeconds(response, body));
    }
    if (!response.ok) {
      throw new AdapterError(`Mastodon rejected the message (HTTP ${response.status})`);
    }

    return {
      external_id: body?.id ? String(body.id) : null,
      external_url: body?.url || null,
    };
  }
}
