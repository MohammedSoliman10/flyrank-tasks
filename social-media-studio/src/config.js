import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { KNOWN_ADAPTERS, PROFILES } from './platforms.js';

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function list(value, fallback) {
  const items = String(value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export function createConfig(env = process.env) {
  const activePlatforms = list(env.PLATFORMS, ['x', 'linkedin']);

  for (const platform of activePlatforms) {
    if (!PROFILES[platform]) {
      throw new Error(
        `Unknown platform "${platform}". Allowed: ${Object.keys(PROFILES).join(', ')}`,
      );
    }
  }

  const adapterOverrides = {
    x: env.ADAPTER_X || PROFILES.x.adapter,
    linkedin: env.ADAPTER_LINKEDIN || PROFILES.linkedin.adapter,
    telegram: env.ADAPTER_TELEGRAM || PROFILES.telegram.adapter,
    discord: env.ADAPTER_DISCORD || PROFILES.discord.adapter,
    mastodon: env.ADAPTER_MASTODON || PROFILES.mastodon.adapter,
  };

  for (const platform of activePlatforms) {
    const adapter = adapterOverrides[platform];
    if (!KNOWN_ADAPTERS.includes(adapter)) {
      throw new Error(
        `Unknown adapter "${adapter}" for ${platform}. Allowed: ${KNOWN_ADAPTERS.join(', ')}`,
      );
    }

    if (adapter === 'telegram' && (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)) {
      throw new Error(
        'The telegram adapter needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. Add them to .env or use a mock adapter.',
      );
    }
    if (adapter === 'discord' && !env.DISCORD_WEBHOOK_URL) {
      throw new Error('The discord adapter needs DISCORD_WEBHOOK_URL.');
    }
    if (adapter === 'mastodon' && !env.MASTODON_ACCESS_TOKEN) {
      throw new Error('The mastodon adapter needs MASTODON_ACCESS_TOKEN.');
    }
  }

  const databasePath = env.DATABASE_PATH
    ? env.DATABASE_PATH === ':memory:'
      ? ':memory:'
      : resolve(PROJECT_ROOT, env.DATABASE_PATH)
    : resolve(PROJECT_ROOT, 'data/social-studio.db');

  return {
    port: positiveInt(env.PORT, 3000),
    databasePath,
    activePlatforms,
    adapterOverrides,
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN || '',
      chatId: env.TELEGRAM_CHAT_ID || '',
    },
    discord: {
      webhookUrl: env.DISCORD_WEBHOOK_URL || '',
    },
    mastodon: {
      baseUrl: env.MASTODON_BASE_URL || 'https://mastodon.social',
      accessToken: env.MASTODON_ACCESS_TOKEN || '',
    },
    workerEnabled: env.WORKER_ENABLED !== 'false',
    workerIntervalMs: positiveInt(env.WORKER_INTERVAL_MS, 1000),
    leaseMs: positiveInt(env.LEASE_MS, 60_000),
    maxAttempts: positiveInt(env.MAX_ATTEMPTS, 3),
    adapterFor(platform) {
      return adapterOverrides[platform] || PROFILES[platform]?.adapter;
    },
  };
}
