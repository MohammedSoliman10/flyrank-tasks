# Task 5 — Polite Books to Scrape Scraper

A small, deliberately boring scraper: Node.js + `fetch` + Cheerio + Zod, with a
disk cache, a 500 ms delay between real requests, schema validation, and a run
report that tells you exactly what happened.

The committed `output/books.json` was produced from the live sandbox on
**2026-10-19** and contains **60 unique books** from the **first 3 catalogue
pages**.

---

## 1. Target classification and permission

| Question | Answer |
| --- | --- |
| Target | [`https://books.toscrape.com/`](https://books.toscrape.com/) |
| What is it? | A public sandbox built specifically for practising web scraping. The books and prices are fictional. |
| Is it production / personal data? | No. There is no login, no checkout, and no user-generated personal data. |
| `robots.txt` | `https://books.toscrape.com/robots.txt` returns **HTTP 404** (no robots file). The absence of a file is not permission to crawl without limits, so this project uses its own stricter limits. |
| Scope | First **3 catalogue pages** only, which contain **60 book links**. |
| Authentication / bypass | None. No CAPTCHA, login, paywall, or anti-bot bypass is involved. |
| Why this target? | It is the recommended practice target for exactly this kind of exercise, and the assignment names it explicitly. |

Even though this is a sandbox, the scraper behaves like a guest:

- sequential requests only (no concurrency);
- at least **500 ms** between real HTTP requests;
- a clear User-Agent with a link back to this repository;
- a **15 s** timeout per request;
- a maximum of 3 catalogue pages and 60 detail pages;
- **no retry** on `403`/`404` (do not hammer a missing or forbidden page);
- **one retry** on a timeout or `5xx` response;
- nothing is scraped beyond the assignment’s scope.

---

## 2. What it does

1. Fetches catalogue pages 1–3 from `https://books.toscrape.com/catalogue/`.
2. Collects product links, resolves the relative URLs, and deduplicates them by
   canonical URL.
3. Fetches each of the 60 detail pages (sequentially, with a delay).
4. Extracts **eight raw fields** plus a cleaned numeric `price_gbp`.
5. Validates every record with a strict Zod schema.
6. Writes valid records, per-page errors, and a run report.
7. Caches every successful HTML response under `cache/` so a second run is
   served locally and does not touch the remote site.

The scraper uses static HTML parsing (Cheerio). It does not launch a browser,
execute JavaScript, or bypass any client-side protection.

---

## 3. Setup and usage

Requires **Node.js 20+** (developed with Node 24.20.0).

```bash
cd task5
npm install
npm test                 # 11 unit tests, no network required
npm run scrape           # live scrape, writes output/
npm run scrape:refresh   # ignore cache and re-fetch every page
npm run scrape:broken    # clean run + one fake URL, writes output/broken/
```

A normal first run makes 63 HTTP requests (3 catalogue + 60 detail pages) and
takes about 42 seconds because of the 500 ms delay plus response time. A second run is served from
`cache/` and finishes in well under a second.

`cache/` is gitignored. It is disposable: delete it or use `--refresh` to force
a fresh scrape. `output/` is committed as evidence, except for the duplicate
60-record book list from the broken run.

Useful flags:

```bash
node src/index.js --help
node src/index.js --output-dir /tmp/books-output
```

---

## 4. Output contract

`output/books.json` is an array. Every object has exactly these fields:

| Field | Type | Source |
| --- | --- | --- |
| `title` | string | `div.product_main h1` |
| `product_url` | URL string | resolved product link |
| `price_text` | string | `p.price_color`, e.g. `"£51.77"` |
| `availability_text` | string | `p.instock.availability`, e.g. `"In stock (22 available)"` |
| `rating_text` | `"One"` … `"Five"` | `p.star-rating` class |
| `description` | string or `null` | the paragraph after `#product_description`; `null` when absent |
| `source_page` | URL string | the catalogue page the book was discovered on |
| `fetched_at` | ISO-8601 string | fetch time, or cache file mtime on a cache hit |
| `price_gbp` | number ≥ 0 | cleaned from `price_text` |

The Zod schema is **strict**, so an unexpected extra field fails validation
instead of silently entering the published output.

Example record (description abridged for readability):

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "It's hard to imagine a world without A Light in the Attic. ...",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-10-19T11:56:11.262Z",
  "price_gbp": 51.77
}
```

`output/errors.json` contains one object per failed or invalid page:

```json
[
  {
    "product_url": "https://books.toscrape.com/catalogue/this-book-does-not-exist_9999/index.html",
    "reason": "HTTP 404",
    "status": 404
  }
]
```

On a clean run it is `[]`.

---

## 5. Clean live run

Command: `npm run scrape`

```text
valid records:  60
invalid records:0
failed pages:   0
network fetches:63
cache hits:     0
duration:       41796 ms
```

The committed [run report](output/run-report.json) records:

```json
{
  "target": "https://books.toscrape.com",
  "started_at": "2026-10-19T11:56:08.272Z",
  "finished_at": "2026-10-19T11:56:50.068Z",
  "duration_ms": 41796,
  "catalogue_pages_fetched": 3,
  "catalogue_page_limit": 3,
  "catalogue_pages": [
    { "url": "https://books.toscrape.com/catalogue/page-1.html", "discovered": 20, "from_cache": false },
    { "url": "https://books.toscrape.com/catalogue/page-2.html", "discovered": 20, "from_cache": false },
    { "url": "https://books.toscrape.com/catalogue/page-3.html", "discovered": 20, "from_cache": false }
  ],
  "unique_book_urls_discovered": 60,
  "pages_attempted": 63,
  "pages_fetched": 63,
  "cache_hits": 0,
  "valid_records": 60,
  "unique_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "total_errors": 0,
  "expected_records": 60,
  "politeness": {
    "user_agent": "FlyRankInternshipA9/1.0 (+https://github.com/MohammedSoliman10/flyrank-tasks/tree/main/task5)",
    "delay_ms": 500,
    "request_timeout_ms": 15000,
    "retry_policy": "Retry once on timeout or HTTP 5xx; never retry 403/404.",
    "concurrency": 1
  }
}
```

Verified with a small check after the run:

```text
books 60, unique urls 60, errors 0
```

---

## 6. One deliberately broken URL

`npm run scrape:broken` runs the normal scrape and appends one fake product URL:

```text
https://books.toscrape.com/catalogue/this-book-does-not-exist_9999/index.html
```

The fake URL returns `404`. The fetch layer does **not** retry it, the detail
loop catches the error, records it, and continues. The committed
[broken-run report](output/broken/run-report.json) and
[broken-run errors](output/broken/errors.json) show the result:

```text
valid records:  60
invalid records:0
failed pages:   1
network fetches:0
cache hits:     63
duration:       906 ms
```

```json
{
  "unique_book_urls_discovered": 61,
  "pages_attempted": 64,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "unique_records": 60,
  "invalid_records": 0,
  "failed_pages": 1,
  "total_errors": 1
}
```

The 60 real books are still written to `output/broken/books.json` (gitignored as
a duplicate). This is the important property: one bad page does not discard the
other 60 valid records.

---

## 7. Cache behaviour

The second run is intentionally offline:

```text
valid records:  60
invalid records:0
failed pages:   0
network fetches:0
cache hits:     63
duration:       193 ms
```

That run used all 3 cached catalogue pages and all 60 cached detail pages. Cache
files are written only after a successful `2xx` HTML response, and writes are
atomic (temporary file + rename). A cache hit uses the file's mtime for
`fetched_at`, so the timestamp still reflects when that HTML was actually
retrieved.

---

## 8. Failure and validation policy

| Situation | Behaviour |
| --- | --- |
| `403` / `404` | Recorded immediately; **no retry** |
| `5xx` | One retry, then recorded |
| Timeout / abort | One retry, then recorded |
| Other network error | Recorded; no retry |
| Non-HTML content type | Recorded as an error |
| Missing/invalid field | Zod rejects the record; reason goes to `errors.json` |
| Missing description | Accepted as `null` |
| Duplicate product URL | Removed with a `Map` keyed by canonical URL |
| Unexpected extra field | Rejected by the strict schema |
| Fewer than 60 discovered books | The run fails loudly instead of publishing a partial file |

Only one retry is allowed. The retry also waits 500 ms before trying again, so a
flaky server is not hammered.

---

## 9. Tests

`npm test` runs 11 tests and makes no external requests:

- catalogue parser resolves relative URLs and the next-page link;
- price parser handles `£51.77` and `£1,234.50`, and rejects non-prices;
- detail parser extracts all eight raw fields + `price_gbp`;
- missing description becomes `null`;
- schema rejects a non-numeric price, missing title, and unknown fields;
- HTTP cache: second request does not touch the server;
- `404` is not retried;
- a `5xx` is retried once and can recover;
- two `5xx` responses fail after exactly one retry;
- `--refresh` bypasses an existing cache file.

```text
tests 11
pass 11
fail 0
```

The unit tests use fixtures in `fixtures/`, plus a local `node:http` server for
the cache/retry tests, so the test suite is deterministic and offline.

---

## 10. Project layout

```text
task5/
  src/
    config.js       # target, limits, delay, UA, paths
    http.js         # delay, timeout, retry, cache
    catalogue.js    # catalogue parsing + URL resolution
    book.js         # detail-page extraction
    text.js         # whitespace and GBP price helpers
    schema.js       # strict Zod contract
    report.js       # run report + atomic JSON output
    index.js        # CLI orchestration
  tests/
    parse.test.js
    http.test.js
  fixtures/
  output/
    books.json
    errors.json
    run-report.json
    broken/
      errors.json
      run-report.json
  cache/            # gitignored, disposable
```

---

## 11. Limitations and honest notes

- This is a single-target exercise, not a general-purpose crawler. The selectors
  are tied to the current Books to Scrape HTML.
- The site is static. If it starts rendering products client-side, Cheerio will
  no longer see them and the run will fail validation or discovery.
- The catalogues are fetched sequentially on purpose. A production scraper
  might add a small worker pool, but that would make politeness harder to prove.
- The descriptions in the sandbox sometimes contain duplicated text and a
  trailing `...more`; the scraper preserves the page text rather than rewriting
  editorial content.
- `price_gbp` is parsed from the displayed GBP string. It is not a currency
  conversion and no tax/shipping calculation is implied.
- No database is used; the assignment asks for JSON files.
- No browser automation was used. The only network calls are the 63 page
  requests plus the deliberate `404` in the broken run.

---

## 12. Commit stages

The implementation is split into small, reviewable commits:

| Stage | What it adds |
| --- | --- |
| 0 | Target classification, project skeleton, limits |
| 1 | Polite HTTP client with timeout, delay, retry, cache |
| 2 | Catalogue discovery and URL deduplication |
| 3 | Detail-page extraction |
| 4 | Strict schema validation and JSON output |
| 5 | Error isolation, broken-URL proof, run report |
| 6 | Tests, sample output, README |

---

## 13. Ethics

Scrape only targets that allow it, keep request volume low, identify yourself,
and stop when you see a `403` or a broken page. This project follows those
rules for a site that exists for this purpose. Do not reuse the code against a
site whose terms, robots file, or technical measures say no.
