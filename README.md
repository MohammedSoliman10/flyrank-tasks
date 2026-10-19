# FlyRank Tasks

Assignments completed for the **FlyRank Backend AI Engineering** internship.

| Assignment | Folder | Status |
| --- | --- | --- |
| Week 3 · A1 — CRUD API with SQLite | [`w3-a1-crud-sqlite`](./w3-a1-crud-sqlite) | ✅ Complete |
| Week 3 · A3 — Containerized PostgreSQL stack | [`task3`](./task3) | ✅ Complete |
| Task 4 — Supabase Auth API | [`task4`](./task4) | ✅ Complete |
| Task 5 — Polite Books to Scrape scraper | [`task5`](./task5) | ✅ Complete |

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


