# Build Log

This is the honest AI-usage log for the Social Media Studio capstone. The
implementation was built with an AI coding assistant in this repository, then
reviewed, run, and corrected locally. The goal of this file is to say where the
assistant helped, where it was wrong, and what changed as a result.

## How the build was done

- **Phase 1 — design.** Chose the current Social Media Studio brief (not the
  retired fake-platform-server PDF). Kept the capstone self-contained in
  `social-media-studio/` with SQLite, Express, and a `SocialPublisher` seam.
- **Phase 2 — ingestion and generation.** Implemented URL/Markdown ingestion,
  deterministic platform captions, and data-driven constraint profiles.
- **Phase 3 — review and adapters.** Implemented draft/approved/rejected/
  published transitions, one real Telegram adapter, Discord and Mastodon
  alternatives, and two mock adapters.
- **Phase 4 — reliability.** Added SQLite slot storage, idempotency keys, a
  claim/lease transaction, stale-lease recovery, 429 `Retry-After` handling, and
  append-only publish history.
- **Phase 5 — evidence.** Added the dashboard, 26 tests, a manual smoke
  transcript, README, EVIDENCE, capstone manifest, and this log.

## Where AI helped

- Scaffolding the Express routes, SQLite schema, service split, and adapter
  classes.
- Drafting the deterministic caption templates and the constraint validator.
- Drafting the first version of the test suite, especially the reliability
  tests for ambiguous timeouts, stale leases, and 429 handling.
- Drafting the README, EVIDENCE, and dashboard HTML.

AI output was treated as a draft, not as proof. Every test was run locally
against the code in this folder, and the manual API transcript was captured from
the running server.

## Where AI was wrong (and what changed)

1. **Retry timestamps used the wall clock instead of the injected `now`.**
   The first publisher used `Date.now()` for the next-attempt timestamp while
   `runDue({ now })` used a supplied time. That made the 429 test depend on the
   real clock and would make deterministic time-advance demos unreliable. Fixed
   by passing `now` into `publishSlot` and computing `nextAttemptAt` from it.

2. **Adapter errors could leak secrets.**
   A raw `fetch` error can contain the Telegram URL, and that URL contains the
   bot token. The first version forwarded the error message. Replaced those
   messages with generic `Telegram/Discord/Mastodon request failed...` errors and
   added a test that asserts a fake bot token is absent from the error text.

3. **The config resolver broke `:memory:` test databases.**
   `resolve(PROJECT_ROOT, ':memory:')` turns the special SQLite value into a file
   path. Fixed by preserving `:memory:` before resolving file paths.

4. **The first adapter-swap test was noise.**
   It built and immediately closed an unused context. Replaced it with a real
   configuration swap (`ADAPTER_X=mock_linkedin`) and an assertion that the same
   X variant publishes through the different mock.

5. **The dashboard was initially missing from the app.**
   `public/index.html` existed but `express.static` was not wired in. Added the
   static mount and a test that `GET /` contains `Social Media Studio`.

6. **The first generated X caption repeated the title twice.**
   The stored Markdown began with the title heading, so the summary repeated the
   opener. Fixed by stripping the leading title from the summary before
   truncation.

7. **The live platform cannot be faked.**
   The assistant could write the Telegram adapter and test it with an injected
   HTTP transport, but it could not create a real bot token or channel. The
   README and EVIDENCE explicitly mark the live send as not executed, rather
   than claiming a real message was delivered. The adapter code path is
   configuration-only to enable.

## Commands used for verification

```bash
cd social-media-studio
npm install
npm test
npm run seed
npm start
curl http://localhost:3000/health
curl http://localhost:3000/api/platforms
```

A full manual flow was also run against the API:

- schedule a draft → `409`;
- patch an X caption to 410 characters → `422 max_length`;
- approve both variants;
- schedule X and LinkedIn;
- run one scheduler pass at an advanced time → two mock posts;
- run it again → `claimed: 0` and no new mock posts;
- inspect `/api/history` and `/api/mock-posts`.

The captured transcript is in [`docs/smoke-test.txt`](docs/smoke-test.txt).

## What was not verified live

- No Telegram bot token, Discord webhook, or Mastodon token was available in
  this environment.
- The real adapters are implemented and covered by contract tests with mocked
  HTTP. Enabling one is a `.env` change; see the README.
- The mock adapters prove exact idempotency. Telegram's API does not accept an
  idempotency key, so its ambiguous-timeout behavior is best-effort local
  protection, not an exact-once guarantee. This is disclosed in the README.

## What I would do next

- Run the real Telegram acceptance probe with a personal bot and channel.
- Add an authenticated admin surface before exposing `/api/admin/tick`.
- Move to PostgreSQL or a real queue if this needed more than one worker host.
- Add DNS-rebinding-safe URL fetching if the ingest endpoint is exposed to
  untrusted users.
