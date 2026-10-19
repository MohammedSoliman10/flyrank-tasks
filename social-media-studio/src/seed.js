import 'dotenv/config';

import { createConfig } from './config.js';
import { openDatabase } from './db.js';
import { CampaignService } from './services/campaigns.js';

const config = createConfig();
const db = openDatabase(config.databasePath);
const campaigns = new CampaignService({ db, config });

const title = 'Why reliability is a product feature';
const existing = db.prepare('SELECT id FROM posts WHERE title = ?').get(title);

if (existing) {
  console.log(`Seed post already exists: ${existing.id}`);
  console.log(JSON.stringify(campaigns.getPost(existing.id), null, 2));
  db.close();
  process.exit(0);
}

const post = await campaigns.ingest({
  title,
  content: `# ${title}

When teams talk about product quality, they usually mean features, polish, or
speed. Reliability is less visible, but it is the property that makes all of
those things trustworthy.

A publishing system that occasionally posts twice is not a small bug. It is a
broken promise. A scheduler that loses a campaign after a restart is not a
minor inconvenience. It is lost work for someone who trusted the tool.

This is why idempotency, durable state, and a review step belong in the first
version of a social publishing workflow, not in a later hardening sprint.

The useful question is not "does the happy path work?" It is "what happens when
the network times out after the platform already accepted the request?" Design
for that question and the happy path becomes boring in the best way.`,
  url: 'https://example.com/blog/reliability-is-a-feature',
});

if (process.argv.includes('--approve')) {
  for (const variant of post.variants) {
    campaigns.approveVariant(variant.id);
  }
  console.log(`Seeded and approved post: ${post.id}`);
} else {
  console.log(`Seeded post: ${post.id}`);
}

console.log(JSON.stringify(campaigns.getPost(post.id), null, 2));
db.close();
