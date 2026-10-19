# FlyRank Tasks

Assignments completed for the **FlyRank Backend AI Engineering** internship.

| Assignment | Folder | Status |
| --- | --- | --- |
| Week 3 · A1 — CRUD API with SQLite | [`w3-a1-crud-sqlite`](./w3-a1-crud-sqlite) | ✅ Complete |
| Week 3 · A3 — Containerized PostgreSQL stack | [`task3`](./task3) | ✅ Complete |

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

