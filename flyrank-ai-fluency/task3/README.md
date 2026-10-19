# Task 3 — What Are You Proving?

**Week 1 · General AI Fluency**

Deliverable: the one-paragraph proof statement (claim + person + action) plus the
one-line why.

## Files

- [`proof-statement.md`](./proof-statement.md) — final statement, one-line why,
  the three decisions, rejected narrowings, and evidence links.

## The submitted paragraph

> I design idempotent, crash-safe backend workflows in Node.js. I build APIs and
> workers that keep one side effect per request, survive restarts, and show the
> failure case in tests instead of claiming reliability in a bio. My proof is
> public: a Supabase auth API with 16 auth tests, a scraper that keeps 60 valid
> records when one URL breaks, and a social publisher that still creates one post
> after an ambiguous timeout. I do this for seed-stage SaaS founders and
> engineering leads who have a flaky job queue, webhook, or retry path and no
> platform engineer to own it. The one thing I want them to do is book a
> 20-minute reliability review, where we trace one failing retry together and
> leave with the smallest fix worth shipping.

**Why this needs to exist:** A CV can list Express and PostgreSQL, but it cannot
show that I know where a retry creates a duplicate side effect or how a worker
recovers from a stale lease; this portfolio makes that judgment visible with
public tests and run transcripts.

## Pass/revise check

| Criterion | How this document meets it |
| --- | --- |
| One primary claim is named | Idempotent, crash-safe backend workflows in Node.js |
| Audience is a specific person who could hire | Seed-stage SaaS founder / engineering lead with a flaky queue, webhook, or retry path |
| A single most-important action is chosen | Book a 20-minute reliability review |
| Statement could only describe this proof | Names retry duplication, stale leases, and three public projects with test counts |
