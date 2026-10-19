# What Are You Proving?

## Final proof statement

I design idempotent, crash-safe backend workflows in Node.js. I build APIs and workers that keep one side effect per request, survive restarts, and show the failure case in tests instead of claiming reliability in a bio. My proof is public: a Supabase auth API with 16 auth tests, a scraper that keeps 60 valid records when one URL breaks, and a social publisher that still creates one post after an ambiguous timeout. I do this for seed-stage SaaS founders and engineering leads who have a flaky job queue, webhook, or retry path and no platform engineer to own it. The one thing I want them to do is book a 20-minute reliability review, where we trace one failing retry together and leave with the smallest fix worth shipping.

## One-line why

A CV can list Express and PostgreSQL, but it cannot show that I know where a retry creates a duplicate side effect or how a worker recovers from a stale lease; this portfolio makes that judgment visible with public tests and run transcripts.

## The three decisions

| Element | Decision |
| --- | --- |
| One claim | **Idempotent, crash-safe backend workflows in Node.js.** Not “full-stack”, not “AI engineer”, not “passionate developer”. |
| One person | A **seed-stage SaaS founder or engineering lead** with a flaky queue, webhook, or retry path and no platform engineer. They can hire a short reliability sprint. |
| One action | **Book a 20-minute reliability review.** Bring one failing retry path; leave with the smallest fix worth shipping. |

## Why the statement could only describe this proof

- It names a specific failure mode: retries, duplicate side effects, restarts,
  and stale leases. A generic portfolio cannot truthfully claim it.
- It points to three public artifacts with numbers a reviewer can check:
  `task4` (16 tests), `task5` (60 records / 11 tests / broken-URL run), and
  `social-media-studio` (26 tests / ambiguous-timeout and stale-lease proofs).
- It names a buyer who has the problem now, not “everyone who needs a website”.
- It asks for one small, low-risk action instead of “hire me” or “download my CV”.

## What I rejected while narrowing

| Rejected version | Why it failed |
| --- | --- |
| “Full-stack developer who builds modern web apps.” | Three skills hiding behind “and”; no specific person or failure. |
| “AI engineer helping businesses leverage LLMs.” | Buzzwords, no proof, and no one can tell what they would hire me to do. |
| “Backend developer open to opportunities.” | The action is vague and puts the work on the reader. |
| “I build reliable systems.” | Too broad. “Reliable” is the claim every portfolio makes; the proof is in the retry and crash cases. |
| “Everyone who needs a backend.” | Not a person who can hire or engage me. |

## Evidence links used in the portfolio

- [Supabase Auth API](https://github.com/MohammedSoliman10/flyrank-tasks/tree/main/task4)
- [Polite Books to Scrape](https://github.com/MohammedSoliman10/flyrank-tasks/tree/main/task5)
- [Social Media Studio](https://github.com/MohammedSoliman10/flyrank-tasks/tree/main/social-media-studio)

These are public repositories, not claims. Each README links to its test output
and run evidence.
