# Task 3 — PostgreSQL in Docker

Week 3 · Assignment A3 — containerize the tasks stack.

This folder is the third storage swap in the project: memory (A1) → SQLite (A2)
→ PostgreSQL running in Docker (A3).

## Stage 0 — run PostgreSQL in Docker

Copy the environment file, then start the database:

```bash
cp .env.example .env
docker compose up -d db
docker ps
```

Open a SQL prompt inside the container:

```bash
docker compose exec db psql -U postgres -d tasks
```

The named volume `taskdata` keeps the rows after the container is removed.

The API, Dockerfile, and full one-command stack are added in the next stages.
