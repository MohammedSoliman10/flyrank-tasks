import { AdapterError, RateLimitError } from './errors.js';

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class DiscordPublisher {
  constructor({ webhookUrl, fetchImpl = globalThis.fetch }) {
    this.name = 'discord';
    this.webhookUrl = webhookUrl;
    this.fetchImpl = fetchImpl;
  }

  async publish({ text }) {
    const url = new URL(this.webhookUrl);
    url.searchParams.set('wait', 'true');

    let response;
    try {
      response = await this.fetchImpl(url.href, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          username: 'FlyRank Social Studio',
          allowed_mentions: { parse: [] },
        }),
      });
    } catch {
      // Do not include the webhook URL in the error: it contains a secret token.
      throw new AdapterError('Discord request failed before receiving a response');
    }

    const body = await readJson(response);
    if (response.status === 429) {
      const retryAfter = body?.retry_after ?? response.headers.get('retry-after') ?? 1;
      throw new RateLimitError('Discord rate limit reached', retryAfter);
    }
    if (!response.ok) {
      throw new AdapterError(`Discord rejected the message (HTTP ${response.status})`);
    }

    return {
      external_id: body?.id ? String(body.id) : null,
      external_url: null,
    };
  }
}
