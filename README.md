# FlyRank Tasks

Assignments completed for the **FlyRank Backend AI Engineering** internship.

| Assignment | Folder | Status |
| --- | --- | --- |
| Week 3 · A1 — CRUD API with SQLite | [`w3-a1-crud-sqlite`](./w3-a1-crud-sqlite) | ✅ Complete |

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
