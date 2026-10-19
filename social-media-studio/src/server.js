import 'dotenv/config';

import { createAdapters } from './adapters/registry.js';
import { createApp } from './app.js';
import { createConfig } from './config.js';
import { openDatabase } from './db.js';
import { CampaignService } from './services/campaigns.js';
import { PublisherService } from './services/publisher.js';
import { Worker } from './worker.js';

let db;
let worker;
let server;

try {
  const config = createConfig();
  db = openDatabase(config.databasePath);
  const adapters = createAdapters({ db, config });
  const campaigns = new CampaignService({ db, config });
  const publisher = new PublisherService({ db, config, adapters });
  const app = createApp({ campaigns, publisher, config });

  worker = new Worker({ publisher, intervalMs: config.workerIntervalMs });
  if (config.workerEnabled) worker.start();

  server = app.listen(config.port, () => {
    console.log(`Social Media Studio listening on http://localhost:${config.port}`);
    console.log(`Platforms: ${config.activePlatforms.join(', ')}`);
    console.log(`Worker: ${config.workerEnabled ? 'enabled' : 'disabled'}`);
  });
} catch (error) {
  console.error(`Could not start Social Media Studio: ${error.message}`);
  process.exit(1);
}

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  worker?.stop();
  server?.close(() => {
    db?.close();
    process.exit(0);
  });
  setTimeout(() => {
    db?.close();
    process.exit(1);
  }, 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
