import { AdapterError, RateLimitError } from './errors.js';

function parseRetryAfter(headers, body) {
  const header = headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }
  if (Number.isFinite(Number(body?.parameters?.retry_after))) {
    return Number(body.parameters.retry_after);
  }
  if (Number.isFinite(Number(body?.retry_after))) return Number(body.retry_after);
  return 1;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class TelegramPublisher {
  constructor({ botToken, chatId, fetchImpl = globalThis.fetch }) {
    this.name = 'telegram';
    this.botToken = botToken;
    this.chatId = chatId;
    this.fetchImpl = fetchImpl;
  }

  async publish({ text }) {
    const endpoint = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    let response;

    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          disable_web_page_preview: false,
        }),
      });
    } catch {
      // Deliberately omit the URL: it contains the bot token.
      throw new AdapterError('Telegram request failed before receiving a response');
    }

    const body = await readJson(response);

    if (response.status === 429) {
      throw new RateLimitError('Telegram rate limit reached', parseRetryAfter(response.headers, body));
    }
    if (!response.ok || body?.ok !== true) {
      const description = body?.description ? `: ${body.description}` : '';
      throw new AdapterError(`Telegram rejected the message (HTTP ${response.status})${description}`);
    }

    const messageId = body?.result?.message_id;
    const username = body?.result?.chat?.username;
    return {
      external_id: messageId == null ? null : String(messageId),
      external_url: username && messageId ? `https://t.me/${username}/${messageId}` : null,
    };
  }
}
