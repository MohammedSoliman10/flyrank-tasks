import { createAdapters } from '../src/adapters/registry.js';
import { createApp } from '../src/app.js';
import { createConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { CampaignService } from '../src/services/campaigns.js';
import { PublisherService } from '../src/services/publisher.js';

export function makeContext({ env = {}, adapterOverrides = {}, fetchImpl } = {}) {
  const config = createConfig({
    PLATFORMS: 'x,linkedin',
    DATABASE_PATH: ':memory:',
    WORKER_ENABLED: 'false',
    ...env,
  });
  const db = openDatabase(':memory:');
  const baseAdapters = createAdapters({ db, config });
  const adapters = { ...baseAdapters, ...adapterOverrides };
  const campaigns = new CampaignService({ db, config });
  const publisher = new PublisherService({
    db,
    config,
    adapters,
    logger: { log() {} },
  });
  const app = createApp({ campaigns, publisher, config, fetchImpl });

  return {
    config,
    db,
    adapters,
    campaigns,
    publisher,
    app,
    close: () => db.close(),
  };
}

export async function ingestSample(context, overrides = {}) {
  return context.campaigns.ingest({
    title: 'Reliable publishing is a product feature',
    content: `# Reliable publishing is a product feature

A retry should never become a duplicate post. Durable scheduling and a review
step are not polish; they are the product promise.

This is the sample post used by the test suite.`,
    url: 'https://example.com/blog/reliable-publishing',
    ...overrides,
  });
}
