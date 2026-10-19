import { profileFor } from '../platforms.js';
import { DiscordPublisher } from './discord.js';
import { MastodonPublisher } from './mastodon.js';
import { MockPublisher } from './mock.js';
import { TelegramPublisher } from './telegram.js';

export function createAdapters({ db, config, fetchImpl = globalThis.fetch }) {
  return {
    mock_x: new MockPublisher({ db, name: 'mock_x' }),
    mock_linkedin: new MockPublisher({ db, name: 'mock_linkedin' }),
    telegram: new TelegramPublisher({
      botToken: config.telegram.botToken,
      chatId: config.telegram.chatId,
      fetchImpl,
    }),
    discord: new DiscordPublisher({
      webhookUrl: config.discord.webhookUrl,
      fetchImpl,
    }),
    mastodon: new MastodonPublisher({
      baseUrl: config.mastodon.baseUrl,
      accessToken: config.mastodon.accessToken,
      fetchImpl,
    }),
  };
}

export function adapterFor(platform, { adapters, config }) {
  const name = config.adapterFor(platform);
  const adapter = adapters[name];
  if (!adapter) throw new Error(`No adapter registered for ${platform} (${name})`);
  return adapter;
}

export function describePlatforms({ config }) {
  return config.activePlatforms.map((platform) => {
    const profile = profileFor(platform);
    const adapter = config.adapterFor(platform);
    const configured =
      adapter.startsWith('mock_') ||
      (adapter === 'telegram' && Boolean(config.telegram.botToken && config.telegram.chatId)) ||
      (adapter === 'discord' && Boolean(config.discord.webhookUrl)) ||
      (adapter === 'mastodon' && Boolean(config.mastodon.accessToken));
    return {
      platform,
      label: profile.label,
      adapter,
      configured,
      profile: {
        max_length: profile.maxLength,
        min_hashtags: profile.minHashtags,
        max_hashtags: profile.maxHashtags,
        max_exclamations: profile.maxExclamations,
        tone: profile.tone,
      },
    };
  });
}
