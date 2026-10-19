# Capstone — Keep the Portfolio Alive

**General AI Fluency · Impact Project**

Deliverable: a short “how to add the next case” note, the named next piece, and
evidence of a reminder set — with the build context preserved so the next update
is cheap.

## Files

| File | What it is |
| --- | --- |
| [`how-to-add-next-case.md`](./how-to-add-next-case.md) | The concrete routine, file path, three-beat template, and definition of done |
| [`claude-project-handoff.md`](./claude-project-handoff.md) | The preserved Claude Project, why it matters, and the next-case prompt |
| [`reminder.ics`](./reminder.ics) | Recurring calendar reminder, 8 weeks from Monday 26 October 2026 |
| [`assets/reminder-evidence.png`](./assets/reminder-evidence.png) | Rendered calendar showing the reminder |

## The next case

**Webhook Delivery Service** — a Node.js service that verifies HMAC signatures,
rejects stale timestamps and replayed delivery IDs, stores events idempotently,
and uses bounded retries plus a dead-letter queue.

**Where it goes:** `/work/webhook-delivery-service`, a fourth card on Home after
the scraper, linked from About. Source file:
`portfolio/content/work/webhook-delivery-service.md`.

**Why this piece:** the current cases prove outbound retry safety, a tested auth
boundary, and partial-failure scraping. This one proves **inbound** idempotency
and replay protection — the same claim on a new failure surface.

## The reminder

- Starts **Monday 26 October 2026, 09:00 UTC**.
- Repeats weekly for eight weeks.
- 15-minute display alarm.
- First instruction: collect the test transcript before drafting.
- Evidence: `reminder.ics` plus the rendered calendar.

## The preserved build context

The Claude Project **Reliability Portfolio — Mohammed Soliman** is kept, not
rebuilt. It already holds the proof statement, the voice card, the six-page
sitemap, the banned-word list, and the “one question at a time, no ghostwriting”
rule. Case four starts with an interview, not a blank page.

Source of truth: [`../task2/claude-project.md`](../task2/claude-project.md).

## Pass/revise check

| Criterion | Where it is met |
| --- | --- |
| Concrete “how to add the next case” note | `how-to-add-next-case.md` has a file path, seven steps, a template, and a definition of done |
| Specific next piece named | Webhook Delivery Service, with the exact route and evidence to collect |
| Real reminder set | `reminder.ics` (recurring, 8 weeks) and `reminder-evidence.png` |
| Build context preserved | `claude-project-handoff.md` and the existing project instructions |

## Honesty note

The reminder is a real `.ics` file that can be imported into any calendar. The
calendar image is a rendered view of that file, not a screenshot from a paid
calendar app. The Claude Project handoff is a local record of the exact
instructions; no live Claude account was available in this environment.
