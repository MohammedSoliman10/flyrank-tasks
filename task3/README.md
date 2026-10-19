# Task 3 — Containerized PostgreSQL Tasks API

The same task CRUD API, now backed by **PostgreSQL running in Docker** and started
together with the app through **one command**:

```bash
docker compose up --build
```

This is the third storage swap in the project: **memory (A1) → SQLite (A2) →
PostgreSQL (A3)**. Routes, request bodies, response shapes, validation, and status
codes are unchanged. Data now survives both an app restart and a database
container restart.

## Architecture

```text
Client → Express API → tasks repository (SQL) → PostgreSQL container → named volume
```

- The API layer never imports `pg`.
- All SQL lives in [`src/tasks-repo.js`](src/tasks-repo.js).
- `docker-compose.yml` runs two services: `api` and `db`.
- Postgres data is stored in the named volume `taskdata`, so removing the
  container does not remove the rows.

## The storage swap, honestly

A2 used a SQLite repository. This project replaces that module with a
Postgres-backed one:

| What | Changed? |
| --- | --- |
| URLs (`/tasks`, `/tasks/:id`) | No |
| Request bodies and validation | No |
| Response shapes (`id`, `title`, `done`, timestamps) | No |
| Status codes (`200`, `201`, `204`, `400`, `404`) | No |
| `src/tasks-repo.js` | Replaced — this is the storage layer |
| `src/app.js` | `async`/`await` added because `pg` is asynchronous |
| `src/server.js` | Wires the repository and retries until Postgres is ready |
| `Dockerfile`, `docker-compose.yml`, `.env.example`, `sql/schema.sql` | New infrastructure |

The one route-file change is mechanical: `await` on repository calls. No URL,
validation rule, status code, or error message changed. The repository is passed
into `createApp()`, so the API does not know which database is behind it.

## Quick start (Docker)

Requirements: Docker Desktop or Docker Engine with Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

Then:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/tasks
```

`docker compose up` starts:

1. `db` — the official `postgres:16-alpine` image with a healthcheck and the
   `taskdata` volume.
2. `api` — this Express app, built from the local `Dockerfile`.
3. The API waits for the database healthcheck before starting.

Useful commands:

```bash
docker compose logs -f api        # API logs
docker compose exec db psql -U postgres -d tasks   # SQL prompt
docker compose down               # stop containers, KEEP the volume
docker compose down -v            # stop and DELETE the database volume
```

On first start the app creates the `tasks` table and inserts three examples.
Restarting the stack does not insert them again.

### Run the API on the host instead

```bash
docker compose up -d db
npm install
npm start
```

`.env` points `DATABASE_URL` at `localhost:5432` for this mode. Inside Compose,
the API receives `db:5432` instead, because `db` is the service name.

## Environment variables

`.env` is git-ignored. `.env.example` is committed with safe development values.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | App on host | Full connection string (`postgres://user:password@host:port/db`) |
| `POSTGRES_USER` | Compose | Database user |
| `POSTGRES_PASSWORD` | Compose | Database password |
| `POSTGRES_DB` | Compose | Database name |
| `POSTGRES_PORT` | Compose | Host port mapped to Postgres (default `5432`) |
| `PORT` | Compose / app | Host port for the API (default `3000`) |

The compose file refuses to start if the `POSTGRES_*` values are missing, so a
hardcoded production password cannot silently slip in. Inside Compose the app's
connection string is assembled from those variables:

```yaml
DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
```

`db` — not `localhost` — is the hostname inside the Docker network.

## API

Base URL: `http://localhost:3000`

| Method | Endpoint | Success | Errors |
| --- | --- | --- | --- |
| `GET` | `/tasks` | `200` array of tasks | `400` invalid query |
| `GET` | `/tasks/:id` | `200` task | `404` unknown id |
| `POST` | `/tasks` | `201` created task + `Location` | `400` invalid body |
| `PUT` | `/tasks/:id` | `200` updated task | `400`, `404` |
| `PATCH` | `/tasks/:id` | `200` updated task | `400`, `404` |
| `DELETE` | `/tasks/:id` | `204` no content | `404` unknown id |
| `GET` | `/stats` | `200` task counts | — |
| `GET` | `/health` | `200` `{ status: "ok", db: "ok" }` | `503` if the DB is down |

Optional query parameters for `GET /tasks` (also implemented in SQL):

| Query | Example | SQL behaviour |
| --- | --- | --- |
| `search` | `/tasks?search=milk` | `title ILIKE $1 ESCAPE '\'` |
| `done` | `/tasks?done=true` | `done = $1` (`true`/`false`/`1`/`0`) |
| `sort` | `/tasks?sort=title` | `id` (default) or `LOWER(title)` |
| `order` | `/tasks?sort=title&order=desc` | `asc` (default) or `desc` |

All user values are passed as **parameterized query** values (`$1`, `$2`, …),
never concatenated into SQL.

### Example `curl -i`

```console
$ curl -i -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d '{"title":"Push project to GitHub","done":true}'

HTTP/1.1 201 Created
X-Powered-By: Express
Location: /tasks/5
Content-Type: application/json; charset=utf-8
Content-Length: 133
ETag: W/"85-UBYOZd8RR8F754fasyQRa1XG+Wc"
Date: Mon, 19 Oct 2026 11:13:21 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":5,"title":"Push project to GitHub","done":true,"created_at":"2026-10-19T11:13:21.505Z","updated_at":"2026-10-19T11:13:21.505Z"}
```

Unknown ids still return exactly the A2 shape:

```bash
curl -i http://localhost:3000/tasks/999
# HTTP/1.1 404 Not Found
# {"error":"Task not found"}
```

## Database screenshot

`docker compose exec db psql -U postgres -d tasks`, then `\dt` and
`SELECT * FROM tasks;`:

![PostgreSQL tasks table shown in psql](docs/database-viewer.png)

Without `psql`, the same data can be printed from the host with:

```bash
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks npm run db:snapshot
```

## Persistence proven

The row data lives on the `taskdata` volume, not inside the disposable `api`
container. To prove it with Docker:

```bash
# 1. Create a row
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Survives a restart","done":false}'

# 2. Remove both containers, keeping the named volume
docker compose down

# 3. Start the stack again
docker compose up -d

# 4. The row is still there
curl http://localhost:3000/tasks
```

`docker compose down` removes containers and networks, but **not** named volumes.
Only `docker compose down -v` deletes `taskdata`.

The automated test suite verifies the same guarantee against a real PostgreSQL
server: it creates a task, stops PostgreSQL, starts it again on the same data
directory, reconnects the repository, and asserts the row is still present. That
test is `data survives a full PostgreSQL stop and start` in
[`tests/api.test.js`](tests/api.test.js).

> Verification note: the environment used to build this folder had no Docker
> daemon, so the compose lifecycle itself was not executed there. The API was
> exercised with `curl` against a real PostgreSQL 18 server, and the test suite
> runs real PostgreSQL (including the stop/start persistence test). The
> `docker-compose.yml` uses the official `postgres:16-alpine` image and the named
> volume `taskdata`. On a machine with Docker, the commands above are the full
> proof.

## Schema and first-run seeding

The schema is one SQL file, [`sql/schema.sql`](sql/schema.sql), executed on every
start with `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT        NOT NULL,
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The three example rows are inserted only when both conditions hold:

1. the `tasks` table is empty, and
2. the `app_meta` table has no `seeded` marker.

The marker matters: if a user deletes every task, restarting must not put the
examples back. Seeding runs in a transaction with a Postgres advisory lock, so
two containers starting at the same time cannot seed twice.

## Tests

```bash
npm install
npm test
```

The suite starts a real **PostgreSQL 18** server with `embedded-postgres` in a
temporary directory, so it needs no Docker and never touches the real database.
It includes 15 tests covering:

- schema creation and one-time seeding (including after deleting every task),
- reads, unknown ids, invalid ids,
- create, update, partial update, delete, all persisted and re-read after an app
  restart,
- validation (`400`) and unknown ids (`404`),
- search, done filtering, sorting, and query validation,
- `/stats` SQL aggregates and `/health` database ping,
- SQL-injection attempts (`' OR 1=1 --`, `1 OR 1=1`) safely treated as data,
- a full PostgreSQL stop/start with data still present.

The endpoint assertions are the same A2 suite, retargeted at PostgreSQL. Passing
the same behaviour against memory, SQLite, and Postgres is what demonstrates
that storage is an implementation detail behind the API.

## Optional stretch: index + `EXPLAIN ANALYZE`

`sql/schema.sql` creates `idx_tasks_done`. [`sql/explain.sql`](sql/explain.sql)
seeds a 100,000-row scratch table and measures the same filtered query before and
after the index. Measured locally with PostgreSQL 18:

```text
BEFORE (sequential scan)
Seq Scan on tasks_bench  (cost=0.00..1736.00 rows=103 width=31) (actual rows=100.00 loops=1)
  Filter: done
  Rows Removed by Filter: 99900
  Buffers: shared hit=736
Planning Time: 0.097 ms
Execution Time: 4.923 ms

AFTER (index scan)
Index Scan using idx_tasks_bench_done on tasks_bench  (cost=0.29..11.84 rows=113 width=31) (actual rows=100.00 loops=1)
  Index Cond: (done = true)
  Index Searches: 1
  Buffers: shared hit=100 read=2
Planning Time: 0.148 ms
Execution Time: 0.111 ms
```

On the five-row demo table the planner may still choose a sequential scan, which
is correct — an index is not automatically faster for tiny tables.

## Project structure

```text
task3/
├── Dockerfile                 # multi-stage production image
├── docker-compose.yml         # api + db + named volume
├── .env.example               # committed template (real .env is ignored)
├── .dockerignore
├── README.md
├── docs/
│   └── database-viewer.png
├── scripts/
│   └── db-snapshot.js         # print tables and rows from DATABASE_URL
├── sql/
│   ├── schema.sql             # idempotent schema
│   └── explain.sql            # index before/after benchmark
├── src/
│   ├── app.js                 # routes, validation, status codes
│   ├── server.js              # connection retry + graceful shutdown
│   └── tasks-repo.js          # all SQL + pg connection
└── tests/
    ├── api.test.js
    └── helpers/
        └── postgres.js        # ephemeral real Postgres for tests
```

## Requirements checklist

- [x] PostgreSQL runs in Docker with a named volume
- [x] One command starts the whole stack: `docker compose up --build`
- [x] Connection string comes from `.env`; `.env` is git-ignored and
      `.env.example` is committed
- [x] Postgres repository replaced the previous storage repository
- [x] Routes, validation, response shapes, and status codes unchanged
- [x] Table created automatically; three examples seeded only on the first run
- [x] Parameterized queries (`$1`, `$2`, …)
- [x] Correct `200` / `201` / `204` / `400` / `404` behaviour
- [x] Persistence proven across an app restart and a PostgreSQL stop/start
- [x] README with one-command run, env vars, endpoint table, `curl -i`, and a
      database screenshot
- [x] Optional: database-backed `/health`, index + `EXPLAIN ANALYZE` measurement
