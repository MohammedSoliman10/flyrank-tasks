import 'dotenv/config';

import { createAdapters } from './adapters/registry.js';
import { createConfig } from './config.js';
import { openDatabase } from './db.js';
import { PublisherService } from './services/publisher.js';

const config = createConfig();
const db = openDatabase(config.databasePath);
const adapters = createAdapters({ db, config });
const publisher = new PublisherService({ db, config, adapters });

const nowArgument = process.argv[2];
const now = nowArgument ? new Date(nowArgument) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('Usage: npm run worker:tick -- [ISO-8601 date]');
  db.close();
  process.exit(1);
}

try {
  const result = await publisher.runDue({ now });
  console.log(JSON.stringify(result, null, 2));
} finally {
  db.close();
}
