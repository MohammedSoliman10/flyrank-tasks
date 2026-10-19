import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiscordPublisher } from '../src/adapters/discord.js';
import { RateLimitError } from '../src/adapters/errors.js';
import { MastodonPublisher } from '../src/adapters/mastodon.js';
import { TelegramPublisher } from '../src/adapters/telegram.js';

function response({ status = 200, body = null, headers = {}, ok = status >= 200 && status < 300 }) {
  return {
    status,
    ok,
    headers: new Headers(headers),
    json: async () => body,
  };
}

test('Telegram adapter sends a real sendMessage request and returns the message id', async () => {
  let captured;
  const publisher = new TelegramPublisher({
    botToken: 'bot-secret',
    chatId: '@demo_channel',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({
        body: { ok: true, result: { message_id: 42, chat: { username: 'demo_channel' } } },
      });
    },
  });

  const result = await publisher.publish({ text: 'Hello #FlyRank' });
  assert.equal(captured.url, 'https://api.telegram.org/botbot-secret/sendMessage');
  assert.equal(captured.options.method, 'POST');
  assert.equal(JSON.parse(captured.options.body).chat_id, '@demo_channel');
  assert.equal(result.external_id, '42');
  assert.equal(result.external_url, 'https://t.me/demo_channel/42');
});

test('Telegram adapter converts 429 into RateLimitError with Retry-After', async () => {
  const publisher = new TelegramPublisher({
    botToken: 'bot-secret',
    chatId: '@demo_channel',
    fetchImpl: async () =>
      response({
        status: 429,
        ok: false,
        headers: { 'retry-after': '7' },
        body: { ok: false, parameters: { retry_after: 7 } },
      }),
  });

  await assert.rejects(
    () => publisher.publish({ text: 'Hello' }),
    (error) => {
      assert.ok(error instanceof RateLimitError);
      assert.equal(error.retryAfterSeconds, 7);
      return true;
    },
  );
});

test('Telegram adapter does not leak the bot token in a network error', async () => {
  const publisher = new TelegramPublisher({
    botToken: 'super-secret-token',
    chatId: '@demo_channel',
    fetchImpl: async () => {
      throw new Error('socket failed for https://api.telegram.org/botsuper-secret-token/sendMessage');
    },
  });

  await assert.rejects(
    () => publisher.publish({ text: 'Hello' }),
    (error) => {
      assert.doesNotMatch(error.message, /super-secret-token/);
      assert.match(error.message, /Telegram request failed/i);
      return true;
    },
  );
});

test('Discord adapter posts to the wait=true webhook endpoint', async () => {
  let captured;
  const publisher = new DiscordPublisher({
    webhookUrl: 'https://discord.com/api/webhooks/123/secret',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ body: { id: 'discord-message-1' } });
    },
  });

  const result = await publisher.publish({ text: 'Hello Discord' });
  assert.match(captured.url, /wait=true/);
  assert.equal(JSON.parse(captured.options.body).content, 'Hello Discord');
  assert.equal(result.external_id, 'discord-message-1');
});

test('Mastodon adapter uses a bearer token and returns the status URL', async () => {
  let captured;
  const publisher = new MastodonPublisher({
    baseUrl: 'https://mastodon.example',
    accessToken: 'mastodon-token',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ body: { id: 'status-1', url: 'https://mastodon.example/@demo/1' } });
    },
  });

  const result = await publisher.publish({ text: 'Hello Mastodon' });
  assert.equal(captured.url, 'https://mastodon.example/api/v1/statuses');
  assert.equal(captured.options.headers.Authorization, 'Bearer mastodon-token');
  assert.equal(result.external_url, 'https://mastodon.example/@demo/1');
});
