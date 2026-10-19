# Evidence

One proof per requirement, captured from the implementation in this folder.
The full test log is committed at [`docs/test-output.txt`](docs/test-output.txt)
and the manual API transcript at [`docs/smoke-test.txt`](docs/smoke-test.txt).

Environment used for the captures:

```text
Node.js v24.20.0
npm test  → 26 tests, 26 pass, 0 fail (≈0.4 s)
GET /      → 200 (dashboard)
GET /health → 200
```

## Requirement checklist

| Requirement | Status | Proof |
| --- | --- | --- |
| Ingestion from URL or pasted Markdown; stored post is the source of truth | ✅ | `ingestion creates one distinct variant per configured platform`, `ingestion accepts pasted Markdown without a URL`, `URL ingestion extracts a title and readable content` |
| Constraint profiles enforced; bad variant blocked with the broken rule named | ✅ | `editing a variant enforces the platform profile and names the broken rule`; smoke test `422` |
| Review workflow `draft / approved / rejected / published`; only approved can be scheduled | ✅ | `approve, reject, and re-approve move a variant through review`; `an unapproved variant cannot be scheduled`; smoke test `409` |
| One `SocialPublisher` interface, one real adapter, and two mock adapters | ✅ (live send not executed — see note) | `src/adapters/registry.js`, `tests/adapters.test.js`, `adapter swap is configuration only` |
| Idempotent publish: same variant + slot never posts twice | ✅ | `a retry after the adapter accepted but the response was lost creates one post`; `a scheduled variant publishes once through the mock adapter`; `the mock adapter itself is idempotent for a repeated key` |
| Durable scheduling; worker restart mid-batch resumes without duplicates | ✅ | `a stale publishing lease from a crashed worker is reclaimed without a duplicate` |
| Publish history records every attempt and result | ✅ | `GET /api/history`; smoke test `attempts` array; dashboard history table |
| Secrets in `.env` only; `.env.example` committed | ✅ | `.gitignore`, `.env.example`; secret scan below |
| README, architecture diagram, exact run/seed steps | ✅ | [`README.md`](README.md) |

## 1. Ingestion

The route validates the body with Zod, then `CampaignService.ingest` either
fetches a public URL (`src/ingestion.js`) or stores pasted Markdown. Generation
uses the returned stored post object, not the request body.

Proof from `npm test`:

```text
✔ ingestion creates one distinct variant per configured platform
✔ ingestion accepts pasted Markdown without a URL
✔ ingestion blocks SSRF-style localhost URLs and malformed input
✔ URL ingestion extracts a title and readable content
```

The URL test fetches this HTML through an injected transport and asserts:

```text
title       = "Fetched post"
content     contains "Hello from the web."
source_url  = "https://example.com/post"
```

The localhost test asserts:

```text
POST /api/posts {"url":"http://127.0.0.1/internal"} → 400
{"error":"URL must point to a public host"}
```

The stored post is visible through `GET /api/posts/:id`; variants are generated
only during ingestion from that record.

## 2. Constraint profiles

Profiles are data in `src/platforms.js`; `validateVariant` in
`src/validation.js` returns rule-tagged errors. The same validator runs on
generation and on `PATCH /api/variants/:id`.

Test proof:

```text
✔ generated captions are distinct and satisfy every active constraint
✔ max_length and max_hashtags are enforced with named rules
✔ min_hashtags, exclamation limits, and banned phrases are enforced
✔ a valid caption reports no errors
```

Manual proof from `docs/smoke-test.txt` (a 410-character X caption):

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json
```

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

This happens on the edit endpoint, before review, and the rule name is part of
the response. Generated drafts are also validated before insertion.

## 3. Review workflow

Statuses are constrained by the database schema and the service:

- `draft` → `approved` or `rejected`
- `rejected` → `approved` or edited back to `draft`
- approved/rejected variants cannot be published until approved
- `published` cannot be edited, approved again, or rejected

Test proof:

```text
✔ approve, reject, and re-approve move a variant through review
✔ an unapproved variant cannot be scheduled
✔ repeated schedule requests for the same active variant are refused
```

Manual proof from `docs/smoke-test.txt`, before approval:

```http
HTTP/1.1 409 Conflict
```

```json
{"error":"Variant must be approved before scheduling (current status: draft)"}
```

No slot is inserted on that path; the test also asserts `SELECT COUNT(*) FROM
slots = 0`.

## 4. Adapter layer

`SocialPublisher` is the only publishing dependency the business logic sees:

```js
await adapter.publish({ variant, text, idempotencyKey });
// { external_id, external_url }
```

Implementations:

| Adapter | File | Kind |
| --- | --- | --- |
| `TelegramPublisher` | `src/adapters/telegram.js` | Real Bot API |
| `DiscordPublisher` | `src/adapters/discord.js` | Real webhook |
| `MastodonPublisher` | `src/adapters/mastodon.js` | Real status API |
| `MockPublisher` (`mock_x`) | `src/adapters/mock.js` | Mock |
| `MockPublisher` (`mock_linkedin`) | `src/adapters/mock.js` | Mock |

`src/adapters/registry.js` maps a platform to an adapter through
`config.adapterFor(platform)`, so `ADAPTER_X=mock_linkedin` swaps the transport
without touching `CampaignService` or `PublisherService`.

Test proof:

```text
✔ adapter swap is configuration only: the same x variant can publish through a different mock
✔ Telegram adapter sends a real sendMessage request and returns the message id
✔ Telegram adapter converts 429 into RateLimitError with Retry-After
✔ Telegram adapter does not leak the bot token in a network error
✔ Discord adapter posts to the wait=true webhook endpoint
✔ Mastodon adapter uses a bearer token and returns the status URL
```

The Telegram test asserts the real endpoint shape:

```text
POST https://api.telegram.org/bot<token>/sendMessage
body: { chat_id, text, disable_web_page_preview: false }
response: { ok: true, result: { message_id, chat: { username } } }
```

### Live real-target note (honest limitation)

No Telegram bot token, Discord webhook, or Mastodon token was available in this
build environment, so **no live message was sent to a real platform**. The real
adapter's request/response and 429 behavior are covered by the injected-HTTP
tests above. Enabling it requires only `.env` values:

```ini
PLATFORMS=x,telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=@your_channel
```

The code path is the same one exercised by the scheduler tests; the only
unverified piece is Telegram's external network response. This is called out in
the README's limitations section rather than hidden.

## 5. Idempotent publish

- `slots.idempotency_key` is `sha256(variant_id:scheduled_for)` and is unique.
- The key is passed to the adapter.
- Mock adapters enforce it with a unique `mock_posts.idempotency_key`.
- The worker only commits success after the adapter returns.
- A retry after an ambiguous timeout uses the same key.

Test proof:

```text
✔ a retry after the adapter accepted but the response was lost creates one post
✔ a scheduled variant publishes once through the mock adapter
✔ the mock adapter itself is idempotent for a repeated key
```

The ambiguous-timeout test deliberately writes to the mock store and then throws
`simulated timeout after the platform accepted the post`. After the first pass:

```text
mock_posts count = 1
slot status      = scheduled (retry scheduled)
```

After the retry:

```text
mock_posts count = 1
published        = 1
publish_attempts = 2   (one failed + one success)
slot status      = published
```

The second scheduler pass in `docs/smoke-test.txt` returns:

```json
{"claimed":0,"published":0,"results":[]}
```

## 6. Durable scheduling and crash recovery

The worker uses `PublisherService.claimTransaction`:

```sql
UPDATE slots
SET status = 'publishing', lease_until = @lease_until, updated_at = @now
WHERE id = @id AND status IN ('scheduled', 'publishing')
```

A `publishing` slot whose `lease_until` is in the past is claimable again by the
next pass. The same idempotency key is reused, so the adapter returns the
original post if the first attempt was accepted.

Test proof:

```text
✔ a stale publishing lease from a crashed worker is reclaimed without a duplicate
✔ publish attempts are capped and a permanently failing slot is marked failed
✔ 429 Retry-After is respected and the publish succeeds after the wait
```

The stale-lease test sets a slot to `publishing` with an expired lease, runs the
worker, and asserts:

```text
claimed   = 1
published = 1
mock_posts count = 1
```

A second run asserts `claimed = 0` and the mock count remains `1`.

The 429 test asserts the first pass records `rate_limited`, leaves the slot
`scheduled` with `next_attempt_at` in the future, refuses to claim it too soon,
then succeeds after the wait.

## 7. Publish history

`publish_attempts` is append-only. `GET /api/history` joins it with the slot,
variant, and post title. The dashboard renders the same rows.

Manual proof from `docs/smoke-test.txt`:

```json
{
  "attempts": [
    {
      "id": 2,
      "slot_id": "33687499-767b-4190-a41d-3185f06cdf93",
      "attempt_no": 1,
      "status": "success",
      "adapter": "mock_linkedin",
      "idempotency_key": "slot_e609579b37964a1d9b99779bf9599760",
      "external_id": "mock_998409a6-b6cc-4afd-93a8-2b7c0b2172e3",
      "error": null,
      "platform": "linkedin",
      "slot_status": "published"
    }
  ]
}
```

The transcript also shows the X attempt and the mock platform preview.

## 8. Secrets clean

`.env` is ignored before the first commit:

```gitignore
node_modules/
.env
data/*.db
data/*.db-shm
data/*.db-wal
```

`.env.example` contains only placeholders and is committed. The secret scan used
for this evidence was:

```bash
find . -path ./node_modules -prune -o -type f -name '.env' -print
grep -RInE '(TELEGRAM_BOT_TOKEN|MASTODON_ACCESS_TOKEN|DISCORD_WEBHOOK_URL)=.+' \
  --exclude-dir=node_modules --exclude-dir=data .
```

Only documentation placeholders (in `README.md` and this file) matched; no
`.env` file exists in the repository. Adapter errors deliberately omit URLs that
contain tokens; the Telegram test asserts the token is absent from a
network-error message.

## 9. README and run steps

The README contains the what/why, architecture diagram, quick start, seed
command, API table, adapter swap, real-target setup, idempotency design, data
model, test list, configuration, limitations, and project layout.

Captured startup:

```text
$ npm start
[worker] started interval=1000ms
Social Media Studio listening on http://localhost:3000
Platforms: x, linkedin
Worker: enabled
```

Captured HTTP checks:

```text
GET /       -> 200
GET /health -> 200
```

## Acceptance probes (Social Media Studio § 10)

| Probe | Evidence | Result |
| --- | --- | --- |
| 1. Ingest sample; variants generated and pass profiles | `ingestion creates one distinct variant per configured platform`; smoke transcript | ✅ |
| 2. Rule-breaking variant blocked, broken rule named | `editing a variant enforces...`; smoke `422 max_length` | ✅ |
| 3. Unapproved schedule refused with 4xx | smoke `409 Variant must be approved`; test asserts zero slots | ✅ |
| 4. Approve, schedule two minutes out, real target publishes | Real adapter + worker path implemented; contract-tested with mocked HTTP. **Live send not executed: no token/channel available.** | ⚠️ not live |
| 5. Force retry / worker restart; exactly one successful post | `a retry after the adapter accepted...`; `a stale publishing lease...` | ✅ |
| 6. Swap adapter in configuration; no business-logic change | `adapter swap is configuration only` | ✅ |

## Reproduce

```bash
cd social-media-studio
npm install
npm test
npm run seed
npm start
# open http://localhost:3000
```

The 26-test suite is deterministic, uses an in-memory database, and requires no
network. The manual transcript was generated against the running API with the
default mock adapters.
