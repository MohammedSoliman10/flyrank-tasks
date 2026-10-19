# Social Media Studio

A capstone service that turns one blog post into a reviewed, scheduled social
campaign. It generates one variant per platform, enforces each platform's
constraint profile, refuses to schedule anything unapproved, and publishes
through a single adapter interface with durable, idempotent scheduling.

This folder is self-contained: its own dependencies, database, tests, and
documentation. It can be lifted into a dedicated
`flyrank-capstone-social-studio` repository unchanged.

## What it does

1. **Ingest** a blog post as pasted Markdown or a public URL. The stored post is
   the source of truth; generation reads only from the stored record.
2. **Generate** platform-specific captions from shared brand voice plus
   platform fragments. X is short, LinkedIn is professional, Telegram is
   conversational.
3. **Validate** every variant against a real constraint profile: maximum
   length, hashtag count, exclamation limit, and banned phrases. A rule-breaking
   caption is blocked before review, with the rule named in the response.
4. **Review** each variant as `draft → approved | rejected → published`. Only an
   approved variant can be scheduled.
5. **Schedule** an approved variant into a durable SQLite slot.
6. **Publish** due slots through a `SocialPublisher` adapter. The worker uses a
   claim/lease transaction, an idempotency key per variant + slot, 429
   `Retry-After` handling, bounded retries, and stale-lease recovery.
7. **Record** every attempt in a visible publish history. The same slot is never
   published twice, even when a retry follows an ambiguous timeout.

The default configuration uses two mock adapters so the whole demo runs with
zero credentials. A real Telegram adapter is included and enabled by
configuration; Discord and Mastodon adapters are also available.

## Architecture

```text
┌───────────────┐   POST /api/posts        ┌──────────────────────────────┐
│ Browser /     │ ───────────────────────▶ │ Express API                   │
│ curl          │                          │  Zod validation at boundary   │
└───────────────┘                          └──────────────┬───────────────┘
                                                          │
                              ┌───────────────────────────▼───────────────────────────┐
                              │ CampaignService                                       │
                              │  ingest → posts (single source of truth)               │
                              │  generate variants → constraint profiles → validation  │
                              │  review: draft / approved / rejected                  │
                              │  schedule approved variants → slots                    │
                              └───────────────────────────┬───────────────────────────┘
                                                          │ SQLite (WAL)
                    ┌─────────────────────────────────────▼─────────────────────────┐
                    │ posts · variants · slots · publish_attempts · mock_posts       │
                    └─────────────────────────────────────┬─────────────────────────┘
                                                          │
                              ┌───────────────────────────▼───────────────────────────┐
                              │ Worker → PublisherService                             │
                              │  claim due / stale slot inside a transaction           │
                              │  idempotency key = variant id + scheduled time         │
                              │  success only after the adapter returns                │
                              └───────────────────────────┬───────────────────────────┘
                                                          │ SocialPublisher
                 ┌────────────────────────┬───────────────┼──────────────────────┐
                 ▼                        ▼               ▼                      ▼
          Telegram (real)             MockX          MockLinkedIn        Discord / Mastodon
          opt-in via .env             local record   local record        optional real targets
```

There are three seams:

- **HTTP → service**: routes validate input and translate domain errors to
  4xx status codes.
- **Service → storage**: SQLite tables hold posts, variants, slots, attempts, and
  mock-platform records.
- **Service → platform**: the app only knows the `SocialPublisher` interface
  (`publish({ variant, text, idempotencyKey })`). Swapping `ADAPTER_X` from
  `mock_x` to another registered adapter changes configuration, not business
  logic.

## Quick start

Requires Node.js 20 or newer and a C++ toolchain for `better-sqlite3` (the
prebuilt binary is normally downloaded by npm).

```bash
cd social-media-studio
npm install
npm run seed
npm start
```

Open <http://localhost:3000> for the campaign dashboard.

`npm run seed` creates one sample post and two draft variants (X and LinkedIn).
The API is also available directly:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/platforms
curl http://localhost:3000/api/posts
```

To seed and approve both variants in one step:

```bash
npm run seed -- --approve
```

The worker starts with the API by default. To run it separately:

```bash
# terminal 1: API only
WORKER_ENABLED=false npm start

# terminal 2: durable worker
npm run worker
```

Run one scheduler pass without waiting for the interval:

```bash
npm run worker:tick
npm run worker:tick -- 2026-10-19T13:00:01.000Z
```

## First demo in about two minutes

1. Start the app and open the dashboard.
2. Try to schedule a **draft** variant. The API returns `409` with
   `Variant must be approved before scheduling`.
3. Approve the X variant. Choose a time and click **Schedule**.
4. Click **Run scheduler now** (or wait for the worker).
5. The mock preview shows one X post, and the publish history shows one
   successful attempt.
6. Click **Run scheduler now** again. Nothing new is published.

The same flow with `curl`:

```bash
# 1. Find the id of a draft variant
curl -s http://localhost:3000/api/posts | jq

# 2. Schedule it while it is still a draft: 409
curl -i -X POST http://localhost:3000/api/variants/<variant-id>/schedule \
  -H 'Content-Type: application/json' \
  -d '{"scheduled_for":"2026-10-19T13:00:00.000Z"}'

# 3. Approve it: 200
curl -X POST http://localhost:3000/api/variants/<variant-id>/approve \
  -H 'Content-Type: application/json' -d '{}'

# 4. Schedule it: 201
curl -X POST http://localhost:3000/api/variants/<variant-id>/schedule \
  -H 'Content-Type: application/json' \
  -d '{"scheduled_for":"2026-10-19T13:00:00.000Z"}'

# 5. Advance time and publish
curl -X POST http://localhost:3000/api/admin/tick \
  -H 'Content-Type: application/json' \
  -d '{"now":"2026-10-19T13:00:01.000Z"}'

# 6. Inspect history and mock platform
curl http://localhost:3000/api/history
curl http://localhost:3000/api/mock-posts
```

## Constraint profiles

Profiles live in [`src/platforms.js`](src/platforms.js). The validator in
[`src/validation.js`](src/validation.js) enforces them on generation **and** on
every edit.

| Platform | Max length | Hashtags | Max `!` | Tone enforcement |
| --- | ---: | ---: | ---: | --- |
| X | 280 | 1–2 | 1 | concise |
| LinkedIn | 1300 | 2–4 | 0 | no `lol`, `omg`, or `!!!` |
| Telegram | 4096 | 1–5 | 2 | conversational |
| Discord | 2000 | 0–3 | 2 | compact community update |
| Mastodon | 500 | 1–3 | 1 | federated-friendly |

A blocked edit returns `422` with a machine-readable rule, for example:

```json
{
  "error": "Constraint validation failed",
  "platform": "x",
  "details": [
    {
      "rule": "max_length",
      "message": "X allows at most 280 characters; got 410"
    }
  ]
}
```

## API

| Method | Path | Purpose | Success |
| --- | --- | --- | --- |
| `GET` | `/health` | Liveness and active platforms | `200` |
| `GET` | `/api/platforms` | Profiles, adapter names, configured state | `200` |
| `POST` | `/api/posts` | Ingest Markdown or URL and generate variants | `201` |
| `GET` | `/api/posts` | List campaigns | `200` |
| `GET` | `/api/posts/:id` | Campaign, variants, and slots | `200` |
| `GET` | `/api/variants/:id` | One variant | `200` |
| `PATCH` | `/api/variants/:id` | Edit text, revalidate, reset to draft | `200` / `422` |
| `POST` | `/api/variants/:id/approve` | Approve a variant | `200` / `409` |
| `POST` | `/api/variants/:id/reject` | Reject a variant with optional reason | `200` / `409` |
| `POST` | `/api/variants/:id/schedule` | Schedule an approved variant | `201` / `409` |
| `GET` | `/api/slots` | Time-slot calendar | `200` |
| `GET` | `/api/history` | Every publish attempt and result | `200` |
| `GET` | `/api/mock-posts` | What the mock adapters posted | `200` |
| `POST` | `/api/admin/tick` | Run one scheduler pass; optional `{ "now": ISO }` | `200` |
| `GET` | `/` | Browser dashboard | `200` |

Ingest body:

```json
{
  "title": "Optional title",
  "url": "https://example.com/post",
  "content": "# Optional pasted Markdown"
}
```

Provide `content`, `url`, or both. If only `url` is given, the service fetches
the page, extracts readable text, and stores it. Private/localhost URLs are
rejected.

## Adapters and a real free target

The interface is deliberately small:

```js
await adapter.publish({ variant, text, idempotencyKey });
// → { external_id, external_url }
```

| Adapter | File | Default? | Notes |
| --- | --- | --- | --- |
| `mock_x` | `src/adapters/mock.js` | yes | Records to `mock_posts`; unique key makes retries idempotent |
| `mock_linkedin` | `src/adapters/mock.js` | yes | Same store, shown in the dashboard |
| `telegram` | `src/adapters/telegram.js` | no | **Real** Bot API `sendMessage`; optional |
| `discord` | `src/adapters/discord.js` | no | Real webhook, `?wait=true` |
| `mastodon` | `src/adapters/mastodon.js` | no | Real status API with bearer token |

### Telegram (recommended real target)

1. Create a bot with [@BotFather](https://t.me/BotFather): `/newbot`, then copy
   the token.
2. Add the bot to a channel you own and give it permission to post. For a public
   channel, the chat id can be `@channel_name`.
3. Copy `.env.example` to `.env` and set:

```ini
PLATFORMS=x,telegram
ADAPTER_X=mock_x
ADAPTER_TELEGRAM=telegram
TELEGRAM_BOT_TOKEN=123456:replace-me
TELEGRAM_CHAT_ID=@your_channel
```

4. `npm run seed -- --approve` (or ingest and approve from the dashboard), then
   schedule the Telegram variant and start the worker.
5. The publish record stores the Telegram `message_id`; for a public channel it
   also stores `https://t.me/<channel>/<message_id>`.

Discord: set `PLATFORMS=discord`, `ADAPTER_DISCORD=discord`, and
`DISCORD_WEBHOOK_URL`. Mastodon: set `PLATFORMS=mastodon`,
`ADAPTER_MASTODON=mastodon`, `MASTODON_BASE_URL`, and
`MASTODON_ACCESS_TOKEN`.

### Adapter swap proof

Changing the adapter is configuration only:

```ini
ADAPTER_X=mock_linkedin
```

The X variant still lives in the `x` platform profile; the same business logic
publishes it through a different `SocialPublisher`. The test suite exercises
this exact swap (`adapter swap is configuration only` in
`tests/api.test.js`).

## Idempotency and durable scheduling

- A slot's idempotency key is a SHA-256 of `variant_id:scheduled_for` and is
  unique in SQLite. The key is passed to the adapter.
- `PublisherService` claims a due slot with a transaction:
  `scheduled → publishing` plus a lease. A second worker cannot claim it.
- If a worker dies mid-publish, the lease expires. The next pass reclaims the
  `publishing` slot and retries with the **same** idempotency key.
- Mock adapters store the key with a unique constraint. A retry after the mock
  accepted but the response was lost returns the original record instead of
  creating a second one.
- Success is committed only after the adapter returns. A timeout is retried with
  capped exponential backoff; a `429` uses the adapter's `Retry-After`.
- After `MAX_ATTEMPTS`, the slot is marked `failed`. The variant remains
  `approved` so a new slot can be scheduled.
- The dashboard and `GET /api/history` show every attempt, including failed and
  rate-limited ones.

## Data model

| Table | Purpose |
| --- | --- |
| `posts` | Stored source post: title, Markdown content, source URL |
| `variants` | One row per post + platform, with caption and review status |
| `slots` | Durable scheduled publish: time, status, key, attempts, lease |
| `publish_attempts` | Append-only history for every adapter call |
| `mock_posts` | What the mock adapters would have posted, with unique key |

Statuses: variants use `draft`, `approved`, `rejected`, `published`; slots use
`scheduled`, `publishing`, `published`, `failed`.

## Tests

```bash
npm test
```

The suite uses an in-memory SQLite database, `supertest`, and mocked HTTP
transports. It does not require a network or any real credentials.

Current result: **26 passing tests, 0 failing**. The full output is committed in
[`docs/test-output.txt`](docs/test-output.txt). It covers:

- generated captions are distinct and valid per profile;
- length, hashtag, exclamation, and banned-phrase rules name the broken rule;
- Markdown and URL ingestion, including localhost/SSRF rejection;
- approval, rejection, editing, and refusal to schedule unapproved variants;
- a successful publish, plus a second scheduler pass producing no duplicate;
- an ambiguous timeout after the platform accepted → retry → one post;
- stale lease recovery after a simulated worker crash;
- `429 Retry-After` waiting and eventual success;
- max-attempt failure handling;
- adapter idempotency for a repeated key;
- adapter swap by configuration;
- Telegram/Discord/Mastodon adapter contracts, including Telegram token
  redaction in errors.

A full manual transcript (unapproved schedule `409`, rule-breaking edit `422`,
scheduling both platforms, publishing, and a duplicate-free second pass) is in
[`docs/smoke-test.txt`](docs/smoke-test.txt). With a seeded server running, the
same transcript can be regenerated with:

```bash
npm run smoke
```

The smoke script uses `jq` for readable JSON summaries.

## Configuration

Copy `.env.example` to `.env`; `.env` is gitignored.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/social-studio.db` | SQLite file |
| `PLATFORMS` | `x,linkedin` | Active variant platforms |
| `ADAPTER_X` | `mock_x` | Adapter for X |
| `ADAPTER_LINKEDIN` | `mock_linkedin` | Adapter for LinkedIn |
| `ADAPTER_TELEGRAM` | `telegram` | Adapter for Telegram |
| `ADAPTER_DISCORD` | `discord` | Adapter for Discord |
| `ADAPTER_MASTODON` | `mastodon` | Adapter for Mastodon |
| `TELEGRAM_BOT_TOKEN` | empty | Real Telegram bot token |
| `TELEGRAM_CHAT_ID` | empty | Channel username or numeric id |
| `DISCORD_WEBHOOK_URL` | empty | Real Discord webhook |
| `MASTODON_BASE_URL` | `https://mastodon.social` | Mastodon instance |
| `MASTODON_ACCESS_TOKEN` | empty | Mastodon user token |
| `WORKER_ENABLED` | `true` | Start worker with the API |
| `WORKER_INTERVAL_MS` | `1000` | Worker poll interval |
| `LEASE_MS` | `60000` | Claim lease before a crashed worker's slot is reclaimable |
| `MAX_ATTEMPTS` | `3` | Attempts before a slot is marked failed |

Secrets are read from the environment only and are never written to the database
or logs. Adapter network errors deliberately omit URLs that contain tokens.

## Limitations

- **The live Telegram/Discord/Mastodon send was not executed in this build
  environment** because no token or channel was available. The real adapters are
  implemented and contract-tested with mocked HTTP; enabling one is a `.env`
  change. The default mock flow is fully exercised end to end.
- Telegram's Bot API has no idempotency-key parameter. The local key and slot
  state protect the normal retry path; an ambiguous network timeout after
  Telegram accepted but before the response arrived remains a theoretical
  duplicate risk for that real adapter. The mock adapters prove the exact
  once-only contract.
- SQLite in WAL mode is durable for a single host and one worker. It is not a
  multi-host queue.
- `/api/admin/tick` is a local demo/testing hook and is unauthenticated. Protect
  or remove it in a deployment.
- The API has no user authentication. The capstone brief does not require it;
  add auth before exposing a public deployment.
- URL ingestion blocks literal private/localhost destinations and validates
  redirects, but does not perform DNS-rebinding-safe address pinning.
- Captions are deterministic templates, not AI-generated. The brief grades
  constraint enforcement, and deterministic output makes tests cheap.
- Image generation, analytics, engagement tracking, and real X/LinkedIn
  accounts are out of scope for the Social Media Studio brief.

## Project layout

```text
social-media-studio/
├── public/index.html          # Browser campaign dashboard
├── src/
│   ├── adapters/              # Telegram, Discord, Mastodon, mocks, registry
│   ├── services/campaigns.js  # Ingest, generate, review, schedule
│   ├── services/publisher.js  # Claim, publish, retry, history
│   ├── app.js                 # Express routes and error mapping
│   ├── captions.js            # Shared + platform caption composition
│   ├── validation.js          # Constraint profiles, named rule errors
│   ├── ingestion.js           # URL fetch / Markdown storage
│   ├── db.js                  # Schema and SQLite setup
│   ├── worker.js              # Polling worker
│   ├── server.js              # API + worker entry point
│   └── seed.js                # Demo data
├── tests/                     # 26 deterministic tests
├── scripts/smoke-test.sh      # Reproducible manual API transcript
├── docs/                      # Test output and manual smoke transcript
├── EVIDENCE.md                # Requirement-by-requirement proofs
├── BUILDLOG.md                # Honest AI usage log
├── capstone.yaml              # Run/seed/test/base_url/endpoints manifest
└── .env.example
```

## License

MIT. See [`LICENSE`](LICENSE).
