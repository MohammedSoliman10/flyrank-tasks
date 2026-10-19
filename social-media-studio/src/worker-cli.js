import 'dotenv/config';

import { createAdapters } from './adapters/registry.js';
import { createConfig } from './config.js';
import { openDatabase } from './db.js';
import { PublisherService } from './services/publisher.js';
import { Worker } from './worker.js';

const config = createConfig();
const db = openDatabase(config.databasePath);
const adapters = createAdapters({ db, config });
const publisher = new PublisherService({ db, config, adapters });
const worker = new Worker({ publisher, intervalMs: config.workerIntervalMs });

console.log(`Worker started for ${config.activePlatforms.join(', ')}`);
worker.start();

function shutdown(signal) {
  console.log(`\n${signal} received, stopping worker...`);
  worker.stop();
  db.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
