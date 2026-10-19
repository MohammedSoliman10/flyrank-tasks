# Frame It as Cases

## Voice card

**Direct, warm, plain, specific. No buzzwords.**

This is a standing instruction in the Claude Project. It applies to every case,
the bio, and the CTA. If a sentence sounds like it could belong to any developer,
it gets cut.

## How these cases are framed

Every case has three beats:

1. **The problem** — the failure or constraint that made the work necessary.
2. **What I did and decided** — the choices that shaped the result, including
   trade-offs.
3. **What came of it** — the observable outcome, with a test or transcript.

No “results-driven” filler. No claiming a result I cannot point to.

---

## Case 1 — Social Media Studio

**One line:** A social publisher that proves one post per slot, even after a
timeout or a worker crash.

### The problem

A scheduled post is a side effect. If the platform accepts a publish and the
response is lost, a naive retry posts it again. If a worker dies mid-batch, the
next worker can either lose the job or duplicate it. The hard part is not calling
an API; it is making the retry safe.

### What I did and decided

- Put every platform behind one `SocialPublisher` interface, with a real Telegram
  adapter and mock X/LinkedIn adapters. The application never knows which
  platform it is publishing to.
- Stored each approved slot in SQLite with an idempotency key derived from the
  variant and scheduled time. The key is unique, so a second slot cannot silently
  represent the same publish.
- Claimed work inside a transaction: `scheduled → publishing` plus a lease. A
  stale lease is reclaimable after a crash, but the retry reuses the same key.
- Committed success only after the adapter returned. A `429` honors
  `Retry-After`; other failures get bounded backoff and a maximum attempt count.
- Put a human review gate in front of scheduling. A draft or rejected variant
  returns `409`; only approved variants can enter the calendar.
- Added a history of every attempt, including failed and rate-limited ones, and a
  small dashboard so the state is visible during a demo.

### What came of it

- 26 deterministic tests pass, including:
  - an ambiguous timeout after the mock platform accepted → retry → **one post**;
  - a stale `publishing` lease → reclaimed → **one post**;
  - a second scheduler pass → `claimed: 0`, **no duplicate**;
  - a `429 Retry-After` → waits, retries, succeeds.
- The committed smoke transcript shows two platforms published and the second
  scheduler pass publishing nothing.
- The real Telegram adapter is implemented; the live send is an opt-in `.env`
  change because no bot token was available in the build environment. That
  limitation is documented in the repo rather than hidden.

**What this proves:** I can design the failure case first, then build a system
that survives it.

---

## Case 2 — Supabase Auth API

**One line:** An Express auth API where the status codes, the JWT boundary, and
the logout behavior are tested, not guessed.

### The problem

Auth is easy to demo and easy to get subtly wrong: a login endpoint that leaks
whether an email exists, a protected route that trusts a header without verifying
it, a logout that clears the browser but leaves the server session valid. The
brief also required specific status codes, so “it works” was not enough.

### What I did and decided

- Used the real Supabase SDK for signup, login, and token verification instead of
  hand-rolling JWT parsing.
- Put verification in one reusable `requireAuth` middleware that calls
  `supabase.auth.getUser(token)`. Protected routes stay small and cannot forget
  the check.
- Returned generic login errors so the endpoint does not reveal whether an email
  is registered.
- Made logout call the GoTrue `/logout` endpoint with the caller’s own JWT, not a
  service-role key. The API stays stateless and does not get more privilege than
  the caller.
- Mapped the contract explicitly: `201` signup, `200` login, `204` logout,
  `400` bad input, `401` missing/invalid token, `403` for the admin-only route.
- Added Swagger UI with Bearer auth and kept `.env` out of git with a committed
  `.env.example`.
- Built a local GoTrue-compatible mock so the full flow could be tested and
  manually exercised without a hosted Supabase project.

### What came of it

- 16 tests pass using the real Supabase SDK against the mock.
- A manual transcript shows signup → login → profile → dashboard → logout, then
  reuse of the old token returning `401`.
- The Swagger screenshot and smoke transcript are committed.
- No `service_role` key is used or committed.

**What this proves:** I can put a trust boundary in one place, test the unhappy
paths, and keep secrets out of the repo.

---

## Case 3 — Polite Books to Scrape

**One line:** A scraper that gets 60 clean records, stays polite, and keeps the
good records when one URL breaks.

### The problem

The sandbox is public, so the work is not “fetch until it works.” It is: request
only the first three catalogue pages, wait between requests, handle a broken URL
without losing the other records, and validate the output before calling it done.
A scraper that returns 59 records and a stack trace is not finished.

### What I did and decided

- Used `fetch` + Cheerio + Zod, with a strict schema for the eight raw fields and
  a numeric `price_gbp`.
- Cached HTML on disk. A second run makes zero network requests; `scrape:refresh`
  bypasses the cache when freshness matters.
- Waited 500 ms between real requests, used a clear User-Agent and a 15 s timeout,
  and checked every status before parsing.
- Retried once on timeout or `5xx`, but never on `403`/`404`. Retrying a missing
  page is just hammering it.
- Isolated failures per URL. A broken detail page becomes an entry in
  `errors.json`; the other valid books still reach `output/books.json`.
- Deduplicated by book URL and wrote a run report with fetch counts, cache hits,
  duration, and validation totals.

### What came of it

- 60 unique, validated books from the first three catalogue pages.
- 11 offline tests pass for parsing, schema validation, cache, and retry policy.
- Clean run: 63 fetches in about 41.8 s.
- Cached run: 0 fetches in about 193 ms.
- Deliberately broken run: 60 valid records preserved, one `HTTP 404` recorded,
  about 906 ms.

**What this proves:** I can write a data pipeline that respects the source,
survives partial failure, and makes its own run observable.

---

## Bio

I’m Mohammed Soliman, a backend engineer. I build systems that stay correct when
the network doesn’t: idempotent APIs, durable background jobs, and webhook or
retry paths that do not create a second side effect. I work mostly in Node.js and
SQL, and I care about the unglamorous parts — keys, leases, status codes, and
tests that reproduce the failure before I claim a fix.

My public work includes a Supabase auth API with 16 tests, a scraper that keeps
60 valid records when one URL breaks, and a social publisher that still creates
one post after an ambiguous timeout. I’m looking for short reliability sprints
with small SaaS teams that have a queue, webhook, or retry problem and no
platform engineer to own it.

## Contact / CTA copy

**Have a workflow that sometimes posts twice, loses a job on restart, or accepts
a webhook it shouldn’t?**

Bring one failing retry path to a 20-minute reliability review. We’ll trace what
happens after the timeout, find where the duplicate or lost work enters, and
leave with the smallest fix worth shipping. No pitch deck, no 40-slide audit.

**Book a 20-minute reliability review →** (`/contact`)

Prefer to read first? Start with the Social Media Studio case.

---

## Before / after: the generic line and the edit

### Before (generic AI copy)

> Results-driven backend developer passionate about building scalable,
> cutting-edge solutions that leverage AI to deliver impactful results.

### After (edited, specific, defensible)

> I build backend workflows that survive retries. If a timeout happens after the
> platform already accepted the request, my system still produces one post — and
> a test proves it.

### What changed

| Generic line | Edited line |
| --- | --- |
| “Results-driven” | A named failure: a timeout after the platform accepted. |
| “Scalable, cutting-edge, impactful” | One observable outcome: one post, not two. |
| Claims a personality trait | Points to a test a reader can inspect. |
| Could describe any developer | Could only describe this project. |

## Edit pass

- Read every case out loud; cut anything I would not say to a founder.
- Check every number against the repository.
- Remove adjectives that are not backed by a link or a test.
- Keep the CTA to one action.
- Check that each case points back to the claim: correctness under failure.
