# FlyRank Tasks

Work completed for the **FlyRank Backend AI Engineering** internship, plus the
**General AI Fluency** track deliverables.

| Assignment | Folder | Status |
| --- | --- | --- |
| Week 3 · A1 — CRUD API with SQLite | [`w3-a1-crud-sqlite`](./w3-a1-crud-sqlite) | ✅ Complete |
| Week 3 · A3 — Containerized PostgreSQL stack | [`task3`](./task3) | ✅ Complete |
| Task 4 — Supabase Auth API | [`task4`](./task4) | ✅ Complete |
| Task 5 — Polite Books to Scrape scraper | [`task5`](./task5) | ✅ Complete |
| Capstone — Social Media Studio | [`social-media-studio`](./social-media-studio) | ✅ Complete · live target opt-in |
| General AI Fluency — tasks 2–5 + capstone | [`flyrank-ai-fluency`](./flyrank-ai-fluency) | ✅ Complete · five folders |

Each assignment lives in its own folder with its own dependencies, database, and
README. More assignments will be added here as the internship progresses.

## Week 3 · A1 — CRUD API with SQLite

A Node.js + Express REST API whose task list is stored in SQLite. The API is the
same as the Week 2 version, but tasks now survive a server restart.

**Highlights**

- Full CRUD: `GET`, `POST`, `PUT`/`PATCH`, `DELETE`
- SQLite database created and seeded automatically on first run
- Input validation with `400` responses and `404` for unknown ids
- SQL-powered search, filtering, sorting, and statistics
- Automated API and persistence tests
- Screenshot of the database in DB Browser for SQLite

```bash
cd w3-a1-crud-sqlite
npm install
npm start
```

Full documentation: [`w3-a1-crud-sqlite/README.md`](./w3-a1-crud-sqlite/README.md)

## Week 3 · A3 — Containerized PostgreSQL stack

The same task API, now running on PostgreSQL in Docker, with the app and database
started together by Compose.

**Highlights**

- PostgreSQL 16 in a container with the named volume `taskdata`
- Multi-stage Node.js image for the API
- `docker compose up --build` starts the whole stack
- Connection string from `.env` (git-ignored; `.env.example` committed)
- Automatic schema creation and one-time seeding
- Repository swap: routes and validation stay the same; only the storage module
  and `await` calls changed
- Parameterized SQL, database-backed `/health`, and an optional `EXPLAIN
  ANALYZE` index benchmark
- Real-PostgreSQL test suite, including a database stop/start persistence test

```bash
cd task3
cp .env.example .env
docker compose up --build
```

Full documentation: [`task3/README.md`](./task3/README.md)

## Task 4 — Supabase Auth API

An Express API with Supabase email/password auth, Bearer JWT verification, a
reusable auth middleware, protected profile/dashboard/admin routes, logout, and
Swagger UI.

**Highlights**

- `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`
- `GET /public/info`, `GET /protected/profile`, `GET /protected/dashboard`
- JWT verification with `supabase.auth.getUser(token)`
- `201` / `200` / `204` / `400` / `401` / `403` behavior, with generic login errors
- Swagger UI at `/docs` with a Bearer authorization scheme
- `.env` ignored; `.env.example` committed; no `service_role` key
- 16 passing tests using the real Supabase SDK against a local GoTrue-compatible mock
- Committed Swagger screenshot and manual smoke-test transcript

Because no hosted Supabase credentials were available in this environment, the
live flow was verified against the local mock. Replacing `SUPABASE_URL` and
`SUPABASE_KEY` in `.env` with real project values needs no code changes.

```bash
cd task4
npm install
npm test
# local demo: npm run mock:supabase, then npm start
```

Full documentation: [`task4/README.md`](./task4/README.md)

## Task 5 — Polite Books to Scrape scraper

A Node.js + Cheerio + Zod scraper for the first 3 catalogue pages of the Books to
Scrape sandbox. It produces 60 unique, validated book records and a run report.

**Highlights**

- 60 unique book pages from exactly 3 catalogue pages
- 8 raw fields plus numeric `price_gbp`
- Strict Zod schema; invalid records go to `errors.json`
- Disk cache, 500 ms delay, 15 s timeout, clear User-Agent, sequential requests
- One retry for timeouts/5xx; no retry for 403/404
- Deliberately broken URL run keeps the 60 valid records and reports the 404
- Committed clean and broken-run reports; cache is gitignored
- 11 offline tests for parsing, validation, cache, and retry behavior

```bash
cd task5
npm install
npm test
npm run scrape          # live run, ~42 seconds; second run is cache-only
npm run scrape:broken   # one fake 404 plus the 60 valid records
```

Full documentation: [`task5/README.md`](./task5/README.md)

## Capstone — Social Media Studio

A self-contained capstone service that turns one blog post into reviewed,
platform-specific social variants and publishes approved variants through a
durable, idempotent scheduler.

**Highlights**

- Ingest a URL or pasted Markdown; the stored post is the source of truth
- Generate distinct X, LinkedIn, and optional Telegram/Discord/Mastodon variants
- Enforce real constraint profiles: length, hashtag count, exclamation limit,
  banned phrases; blocked edits name the broken rule
- Review workflow: `draft → approved | rejected → published`; unapproved
  variants return `409` and cannot be scheduled
- One `SocialPublisher` interface with Telegram (real), Discord, Mastodon, and
  two mock adapters; platform transport is selected by configuration
- Durable SQLite scheduler with claim/lease recovery, idempotency keys,
  `429 Retry-After` handling, bounded retries, and append-only history
- Browser campaign dashboard, seeded demo, 26 deterministic tests, and a
  committed evidence pack

The default configuration uses the two mock adapters so the demo needs no
credentials. The real Telegram adapter is enabled with `.env` values; the live
send was not executed in this environment because no bot token was available.
That limitation is documented in the capstone README and EVIDENCE.

```bash
cd social-media-studio
npm install
npm run seed
npm start
# open http://localhost:3000
```

Full documentation: [`social-media-studio/README.md`](./social-media-studio/README.md)

## General AI Fluency — tasks 2–5 + capstone

A five-folder submission for the **General AI Fluency** track. The through-line
is a narrow portfolio claim for Mohammed Soliman: *I design idempotent,
crash-safe backend workflows in Node.js.* The audience is a seed-stage SaaS
founder or engineering lead with a flaky queue, webhook, or retry path; the one
action is a 20-minute reliability review.

| Folder | Deliverable |
| --- | --- |
| [`flyrank-ai-fluency/task2`](./flyrank-ai-fluency/task2) | Sitemap sketch, Claude Project configuration, pressure-test prompt + output |
| [`flyrank-ai-fluency/task3`](./flyrank-ai-fluency/task3) | One-paragraph proof statement + one-line why |
| [`flyrank-ai-fluency/task4`](./flyrank-ai-fluency/task4) | Voice card, three framed cases, bio, CTA, before/after edit |
| [`flyrank-ai-fluency/task5`](./flyrank-ai-fluency/task5) | Weak baseline + five single-layer prompt versions + final reusable prompt |
| [`flyrank-ai-fluency/capstone`](./flyrank-ai-fluency/capstone) | Next-case playbook, named next piece, recurring reminder evidence, preserved Claude Project |

Each folder has its own README and assets. The Claude screenshots are local
renders of the exact configuration/transcript text; the provenance is stated in
the folder READMEs. Full index:
[`flyrank-ai-fluency/README.md`](./flyrank-ai-fluency/README.md)


