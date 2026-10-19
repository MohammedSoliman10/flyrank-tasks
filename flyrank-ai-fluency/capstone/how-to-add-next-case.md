# How to Add the Next Case

The portfolio only stays useful if adding a case is cheap. This is the exact
routine, written so future-me can do it without rebuilding the site or the
Claude Project.

## Where the next case goes

| Item | Location |
| --- | --- |
| Case page | `/work/webhook-delivery-service` |
| Source file | `portfolio/content/work/webhook-delivery-service.md` |
| Home card | Fourth card in **Selected work**, after **Polite Books to Scrape** |
| Sitemap | Add below the three existing case pages |
| About page | Add one proof link beside the existing three |
| CTA | Keep the same action: **book a 20-minute reliability review** |

The case page is a sibling of the three current cases. It is linked from Home and
About; no new index page, no “resources” section.

## The named next piece

**Webhook Delivery Service** — a small Node.js service that:

- verifies an HMAC signature on every inbound webhook;
- rejects stale timestamps and replayed delivery IDs;
- stores each event with a unique idempotency key;
- hands accepted events to a consumer with bounded retries and a dead-letter
  queue;
- exposes one metric for accepted, duplicate, rejected, and dead-lettered events.

This is the next case because it extends the same claim — correctness under
failure — into a different failure surface. The current cases prove outbound
idempotency (publishing), a trust boundary (auth), and partial-failure data work
(scraping). This one proves **inbound** idempotency and replay protection.

### Evidence to collect before writing

- [ ] Public repo with a README quick start.
- [ ] Test output for: valid signature, bad signature, stale timestamp, replayed
      delivery ID, duplicate event, retry exhausted → dead letter.
- [ ] One run transcript showing a duplicate delivery accepted once.
- [ ] One short “what I decided” note: why HMAC, why timestamp + delivery ID, why
      a dead-letter table instead of infinite retries.
- [ ] A number for the outcome: tests passing, duplicate events collapsed, or
      p95 handling time.

## The steps

### 1. Ship the work and freeze the evidence

Do not start the case until the repo, tests, and one real run transcript exist.
The case is framing, not fiction. Save the exact test command and the output.

### 2. Open the preserved Claude Project

Open **Reliability Portfolio — Mohammed Soliman** in Claude. Do not create a new
project. The custom instructions already contain the proof statement, voice card,
and the one action.

Paste the repo link and the test output, then send:

```text
Stay in the existing project and keep the voice card. I am adding the fourth
case: a webhook delivery service with HMAC verification, replay protection,
idempotent event storage, retries, and a dead-letter queue. Interview me one
question at a time. Focus on the problem, the decisions I made, and what came of
it. Do not write the case until I have answered.
```

### 3. Answer the interview honestly

One question at a time. Useful questions to expect:

1. What was the failure before this service existed?
2. What did a replayed webhook do to the consumer?
3. Why HMAC instead of a shared token?
4. Why both a timestamp and a delivery ID?
5. What happens when the consumer is down for an hour?
6. What did you decide *not* to build?
7. What number or transcript proves it works?

Messy answers are fine. Do not let the model smooth them into a generic success
story.

### 4. Draft the three beats

Create `portfolio/content/work/webhook-delivery-service.md` from this template:

```markdown
---
title: Webhook Delivery Service
slug: webhook-delivery-service
order: 4
claim: Correctness under failure
summary: One line with the failure and the outcome.
evidence:
  - label: Test output
    href: https://github.com/.../tests
---

## The problem

The failure in plain language. What broke, or what would have broken?

## What I did and decided

The choices that shaped the result, including the trade-off I rejected.

## What came of it

The observable outcome. A number, a test name, a transcript. No adjectives
without evidence.

## What this proves

One sentence that points back to the claim and the CTA.
```

### 5. Edit hard, out loud

Read every line aloud. Cut anything I would not say to a founder. Run this check:

- Does the first sentence name the failure?
- Is there a decision with a trade-off, not just a task list?
- Is every adjective backed by a number or a link?
- Does it sound like the voice card: direct, warm, plain, specific, no buzzwords?
- Does the last line point at the 20-minute review?

### 6. Wire it into the site

- Add the fourth card to Home, after the scraper.
- Add the case link to About.
- Add `/work/webhook-delivery-service` to the sitemap.
- Check that the Home proof strip still has three lines; do not let it become a
  résumé.
- Keep the CTA the same. Do not add a second action.

### 7. Verify and publish

- [ ] Case page builds and the link is not broken.
- [ ] Repo and test links resolve.
- [ ] The three beats are present.
- [ ] Voice card pass done out loud.
- [ ] CTA points to `/contact`.
- [ ] Sitemap updated.
- [ ] Deploy, then open the page on a phone and a laptop.

## Definition of done

The case is done when a skeptical founder can answer these three questions in
under a minute:

1. What failure did this fix?
2. What did Mohammed decide that a generic developer would not?
3. Where can I check the proof?

If any answer is “it says so in the bio”, the case is not done.

## Reminder

A recurring calendar reminder is set for **Monday 26 October 2026, 09:00 UTC**,
weekly for eight weeks. The `.ics` file is [`reminder.ics`](./reminder.ics); the
rendered calendar is [`assets/reminder-evidence.png`](./assets/reminder-evidence.png).

The reminder text includes the first action: *collect the test transcript before
drafting the case*.
